import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

/**
 * Operational admin queries — orders, payments, bookings, emails, system.
 *
 * Service-role reads, like the rest of `lib/admin`: every page calling these
 * must have passed `requirePermission()` first (note 06 §2, note 08 §61).
 */

type OrderStatus = Database["public"]["Enums"]["order_status"];
type BookingStatus = Database["public"]["Enums"]["booking_status"];
type BookableType = Database["public"]["Enums"]["bookable_type"];
type EmailStatus = Database["public"]["Enums"]["email_status"];

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "paid", "pending", "processing", "failed", "cancelled", "refunded",
];
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "confirmed", "pending", "completed", "cancelled", "no_show",
];
export const BOOKABLE_TYPES: readonly BookableType[] = [
  "event", "group_coaching_session", "private_coaching", "cohort_workshop", "retreat", "masterclass",
];
export const EMAIL_STATUSES: readonly EmailStatus[] = ["pending", "sent", "failed", "cancelled"];

export const BOOKABLE_LABEL: Record<BookableType, string> = {
  event: "Event",
  group_coaching_session: "Group coaching",
  private_coaching: "Private coaching",
  cohort_workshop: "Cohort workshop",
  retreat: "Retreat",
  masterclass: "Masterclass",
};

export function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

export type Person = { id: string; name: string | null; email: string | null };

/**
 * Names and email addresses for a set of accounts.
 *
 * An email lives in `auth.users`, which PostgREST cannot join, so it is read
 * per account through the auth admin API. Callers pass the ids of one page of
 * rows (≤ 200), never the whole user base.
 */
export async function peopleByIds(ids: Array<string | null | undefined>): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const people = new Map<string, Person>();
  if (unique.length === 0) return people;

  const admin = createAdminClient();
  const [{ data: profiles }, users] = await Promise.all([
    admin.from("profiles").select("user_id,display_name,first_name,last_name").in("user_id", unique),
    Promise.all(unique.map((id) => admin.auth.admin.getUserById(id).then((r) => r.data.user))),
  ]);

  const nameOf = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
    ]),
  );
  for (const id of unique) {
    const user = users.find((u) => u?.id === id);
    people.set(id, { id, name: nameOf.get(id) ?? null, email: user?.email ?? null });
  }
  return people;
}

/* ─── Orders ───────────────────────────────────────────────────────────── */

export type AdminOrder = {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  status: OrderStatus;
  total: number;
  currency: string;
  created_at: string;
  paid_at: string | null;
};

export async function adminOrderList(status?: OrderStatus, limit = 200) {
  const admin = createAdminClient();
  let request = admin
    .from("orders")
    .select("id,user_id,guest_email,status,total,currency,created_at,paid_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) request = request.eq("status", status);

  const [{ data }, counts] = await Promise.all([request, countBy("orders", "status", ORDER_STATUSES)]);
  return { orders: (data ?? []) as AdminOrder[], counts };
}

export async function adminOrderDetail(id: string) {
  const admin = createAdminClient();
  const [{ data: order }, { data: items }, { data: payments }, { data: bookings }, { data: grants }] =
    await Promise.all([
      admin
        .from("orders")
        .select("id,user_id,guest_email,status,subtotal,discount_total,total,currency,checkout_mode,external_reference,created_at,paid_at")
        .eq("id", id)
        .maybeSingle(),
      admin
        .from("order_items")
        .select("id,product_name_snapshot,quantity,unit_amount,total_amount")
        .eq("order_id", id)
        .order("created_at"),
      admin
        .from("payments")
        .select("id,amount,currency,status,provider,provider_payment_id,receipt_url,paid_at,created_at")
        .eq("order_id", id)
        .order("created_at"),
      admin
        .from("bookings")
        .select("id,bookable_type,status,starts_at,reference")
        .eq("order_id", id),
      admin
        .from("entitlements")
        .select("id,resource_type,status,quantity,quantity_used,expires_at")
        .eq("source_type", "purchase")
        .eq("source_id", id),
    ]);

  return {
    order,
    items: items ?? [],
    payments: payments ?? [],
    bookings: bookings ?? [],
    entitlements: grants ?? [],
  };
}

/* ─── Payments ─────────────────────────────────────────────────────────── */

export async function adminPayments(limit = 200) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payments")
    .select("id,order_id,amount,currency,status,provider,provider_payment_id,receipt_url,paid_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

/**
 * Orders Stripe may have taken money for that never reached `paid` — the
 * same set the reconciliation job sweeps (note 09 §45).
 */
export async function awaitingReconciliation() {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("orders_awaiting_reconciliation", {});
  if (error) return [];
  return (data ?? []) as AdminOrder[];
}

/* ─── Bookings ─────────────────────────────────────────────────────────── */

export type AdminBooking = {
  id: string;
  user_id: string;
  bookable_type: BookableType;
  bookable_id: string;
  status: BookingStatus;
  starts_at: string | null;
  reference: string | null;
  checked_in_at: string | null;
  entitlement_id: string | null;
  hold_expires_at: string | null;
  created_at: string;
  title: string | null;
};

export async function adminBookingList(
  filter: { type?: BookableType; status?: BookingStatus },
  limit = 200,
) {
  const admin = createAdminClient();
  let request = admin
    .from("bookings")
    .select("id,user_id,bookable_type,bookable_id,status,starts_at,reference,checked_in_at,entitlement_id,hold_expires_at,created_at")
    .order("starts_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (filter.type) request = request.eq("bookable_type", filter.type);
  if (filter.status) request = request.eq("status", filter.status);

  const [{ data }, counts] = await Promise.all([request, countBy("bookings", "bookable_type", BOOKABLE_TYPES)]);
  const rows = (data ?? []) as Array<Omit<AdminBooking, "title">>;

  // `bookable_id` is polymorphic, so titles are resolved per type.
  const ids = (type: BookableType) => rows.filter((r) => r.bookable_type === type).map((r) => r.bookable_id);
  const titles = new Map<string, string>();
  const [events, sessions, slots, workshops, retreats, masterclasses] = await Promise.all([
    ids("event").length ? admin.from("events").select("id,name").in("id", ids("event")) : null,
    ids("group_coaching_session").length
      ? admin.from("group_coaching_sessions").select("id,title").in("id", ids("group_coaching_session"))
      : null,
    ids("private_coaching").length
      ? admin.from("private_coaching_slots").select("id,private_coaching_services(name)").in("id", ids("private_coaching"))
      : null,
    ids("cohort_workshop").length
      ? admin.from("cohort_workshops").select("id,title").in("id", ids("cohort_workshop"))
      : null,
    ids("retreat").length ? admin.from("retreats").select("id,title").in("id", ids("retreat")) : null,
    ids("masterclass").length ? admin.from("masterclasses").select("id,title").in("id", ids("masterclass")) : null,
  ]);
  for (const e of events?.data ?? []) titles.set(e.id, e.name);
  for (const s of sessions?.data ?? []) titles.set(s.id, s.title);
  for (const s of (slots?.data ?? []) as unknown as Array<{ id: string; private_coaching_services: { name: string } | null }>) {
    titles.set(s.id, s.private_coaching_services?.name ?? "Private coaching");
  }
  for (const w of workshops?.data ?? []) titles.set(w.id, w.title);
  for (const r of (retreats?.data ?? []) as Array<{ id: string; title: string }>) titles.set(r.id, r.title);
  for (const m of (masterclasses?.data ?? []) as Array<{ id: string; title: string }>) titles.set(m.id, m.title);

  return {
    bookings: rows.map((r) => ({ ...r, title: titles.get(r.bookable_id) ?? null })),
    counts,
  };
}

/* ─── Emails ───────────────────────────────────────────────────────────── */

export async function adminEmails(status?: EmailStatus, limit = 200) {
  const admin = createAdminClient();
  let request = admin
    .from("email_messages")
    .select("id,template,to_email,to_name,status,attempts,last_error,next_attempt_at,sent_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (status) request = request.eq("status", status);

  const [{ data }, counts] = await Promise.all([request, countBy("email_messages", "status", EMAIL_STATUSES)]);
  return { emails: data ?? [], counts };
}

/* ─── System ───────────────────────────────────────────────────────────── */

/**
 * What the Settings page reports. Booleans and modes only — never a secret,
 * nor any part of one beyond Stripe's public `sk_test` / `sk_live` prefix.
 */
export async function systemStatus() {
  const admin = createAdminClient();
  const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";

  const [lastWebhook, oldestPending, failedEmails] = await Promise.all([
    admin
      .from("processed_webhook_events")
      .select("processed_at,provider")
      .order("processed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("email_messages")
      .select("created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin.from("email_messages").select("*", { count: "exact", head: true }).eq("status", "failed"),
  ]);

  return {
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    supabaseHost: hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
    stripe: {
      configured: stripeKey.length > 0,
      mode: stripeKey.startsWith("sk_live") ? "live" : stripeKey.startsWith("sk_test") ? "test" : null,
      webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    },
    brevo: Boolean(process.env.BREVO_API_KEY),
    cron: Boolean(process.env.CRON_SECRET),
    lastWebhookAt: lastWebhook.data?.processed_at ?? null,
    oldestPendingEmailAt: oldestPending.data?.created_at ?? null,
    failedEmails: failedEmails.count ?? 0,
  };
}

function hostOf(url: string | undefined) {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

type CountableTable = "orders" | "bookings" | "email_messages";

/** Row counts per value of one enum column, for filter tabs. */
async function countBy<T extends string>(
  table: CountableTable,
  column: string,
  values: readonly T[],
): Promise<Record<T | "all", number>> {
  const admin = createAdminClient();
  const [all, ...each] = await Promise.all([
    admin.from(table).select("*", { count: "exact", head: true }),
    ...values.map((v) =>
      admin.from(table).select("*", { count: "exact", head: true }).eq(column, v),
    ),
  ]);
  const counts = { all: all.count ?? 0 } as Record<T | "all", number>;
  values.forEach((v, i) => {
    counts[v] = each[i].count ?? 0;
  });
  return counts;
}

/** Staff roles held by each of a set of accounts — for the people list. */
export async function rolesByUser(ids: string[]): Promise<Map<string, string[]>> {
  const roles = new Map<string, string[]>();
  if (ids.length === 0) return roles;
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("user_id,roles(name)").in("user_id", ids);
  for (const row of (data ?? []) as unknown as Array<{ user_id: string; roles: { name: string } | null }>) {
    if (!row.roles) continue;
    roles.set(row.user_id, [...(roles.get(row.user_id) ?? []), row.roles.name]);
  }
  return roles;
}
