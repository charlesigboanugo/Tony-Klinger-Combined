import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Private coaching availability — migration 0020, note 09 §35 (book-first).
 *
 * Times come from `private_coaching_availability`, a security-definer function
 * that returns only start and end: the slots table itself carries the call
 * link and stays unreadable to customers.
 */
export type OpenSlot = { id: string; startsAt: string; endsAt: string };

export async function openSlots(serviceId: string): Promise<OpenSlot[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("private_coaching_availability", { p_service_id: serviceId });
  return ((data ?? []) as Array<{ slot_id: string; starts_at: string; ends_at: string }>).map((s) => ({
    id: s.slot_id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
  }));
}

/** Unspent private sessions of this service the caller holds (paid, or returned by a cancellation). */
export async function privateCredits(serviceId: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("entitlements")
    .select("quantity,quantity_used,expires_at")
    .eq("user_id", user.id)
    .eq("resource_type", "private_coaching")
    .eq("resource_id", serviceId)
    .eq("status", "active")
    .not("quantity", "is", null);

  const now = Date.now();
  return (data ?? []).reduce((sum, e) => {
    if (e.expires_at && +new Date(e.expires_at) <= now) return sum;
    return sum + Math.max((e.quantity ?? 0) - (e.quantity_used ?? 0), 0);
  }, 0);
}

export type PrivateCredit = { slug: string; name: string; durationMinutes: number; remaining: number };

/**
 * Every private coaching service the caller still has sessions of to book —
 * what /bookings lists beside group sessions, so a paid-for session that was
 * never scheduled (or was returned by a cancellation) is one click from a time.
 */
export async function myPrivateCredits(): Promise<PrivateCredit[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("entitlements")
    .select("resource_id,quantity,quantity_used,expires_at")
    .eq("user_id", user.id)
    .eq("resource_type", "private_coaching")
    .eq("status", "active")
    .not("quantity", "is", null);

  const now = Date.now();
  const remaining = new Map<string, number>();
  for (const e of data ?? []) {
    if (!e.resource_id || (e.expires_at && +new Date(e.expires_at) <= now)) continue;
    const left = Math.max((e.quantity ?? 0) - (e.quantity_used ?? 0), 0);
    if (left > 0) remaining.set(e.resource_id, (remaining.get(e.resource_id) ?? 0) + left);
  }
  if (remaining.size === 0) return [];

  const { data: services } = await supabase
    .from("private_coaching_services")
    .select("id,name,slug,duration_minutes")
    .in("id", [...remaining.keys()])
    .eq("status", "published")
    .order("name");

  return (services ?? []).map((s) => ({
    slug: s.slug,
    name: s.name,
    durationMinutes: s.duration_minutes,
    remaining: remaining.get(s.id) ?? 0,
  }));
}
