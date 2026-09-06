import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Account queries — note 01 §6, note 03 §24.
 *
 * Every read here is scoped to the signed-in customer by RLS. A bug in a filter
 * produces an empty page, never another customer's data (note 08 §59).
 */

export type Profile = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  status: string;
};

export async function myProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_id,first_name,last_name,display_name,status")
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

export type OrderSummary = {
  id: string;
  status: string;
  currency: string;
  total: number;
  created_at: string;
  paid_at: string | null;
};

export async function myOrders(): Promise<OrderSummary[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id,status,currency,total,created_at,paid_at")
    .order("created_at", { ascending: false });
  return (data as OrderSummary[] | null) ?? [];
}

export async function myOrder(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(
      "id,status,currency,subtotal,discount_total,total,created_at,paid_at," +
        "order_items(id,product_name_snapshot,unit_amount,quantity,total_amount)",
    )
    .eq("id", id)
    .maybeSingle();

  return (data as unknown as {
    id: string;
    status: string;
    currency: string;
    subtotal: number;
    discount_total: number;
    total: number;
    created_at: string;
    paid_at: string | null;
    order_items: Array<{
      id: string;
      product_name_snapshot: string;
      unit_amount: number;
      quantity: number;
      total_amount: number;
    }>;
  } | null) ?? null;
}

export type EntitlementRow = {
  id: string;
  resource_type: string;
  resource_id: string | null;
  source_type: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  quantity: number | null;
  quantity_used: number;
};

/**
 * The customer's own view of their access — R23, note 03 §24.
 *
 * Answers the questions note 01 §28 says a customer must be able to answer for
 * themselves: what do I have, where did it come from, how much is left, and
 * when does it end.
 *
 * Read-only. Granting and revoking live in /admin/entitlements, which is a
 * different area for different people (note 06 §23.1).
 */
export async function myEntitlements(): Promise<EntitlementRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("entitlements")
    .select(
      "id,resource_type,resource_id,source_type,status,starts_at,expires_at,quantity,quantity_used",
    )
    .order("created_at", { ascending: false });
  return (data as EntitlementRow[] | null) ?? [];
}

export async function mySubscriptions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id,status,membership_tier,current_period_end,cancel_at")
    .order("created_at", { ascending: false });

  return (data as Array<{
    id: string;
    status: string;
    membership_tier: string | null;
    current_period_end: string | null;
    cancel_at: string | null;
  }> | null) ?? [];
}

export async function myNotifications() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id,type,title,body,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  return (data as Array<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    read_at: string | null;
    created_at: string;
  }> | null) ?? [];
}

/** Human labels for the entitlement vocabulary (note 08 §19). */
export const RESOURCE_LABELS: Record<string, string> = {
  course: "Course",
  group_coaching_series: "Group Coaching series",
  group_coaching_session: "Group Coaching sessions",
  cohort: "Interactive Cohort",
  retreat: "Retreat",
  event: "Event",
  masterclass: "Masterclass",
  resource: "Resource",
  release: "New release",
  partner_discount: "Partner discount",
};

export const SOURCE_LABELS: Record<string, string> = {
  purchase: "Bought directly",
  membership: "Included with membership",
  bundle: "Part of a bundle",
  promotion: "Promotion",
  admin_grant: "Granted by us",
  other: "Other",
};
