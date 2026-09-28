import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Operational figures for the Admin dashboard — note 06 §14.
 *
 * The dashboard previously showed the operator their own email, roles and a
 * permission count. That tells them nothing about the business: it answers
 * "who am I?" when the question on opening an admin workspace is "what needs
 * me?".
 *
 * SERVICE ROLE, deliberately and narrowly. These are cross-customer aggregates
 * that no single user's RLS view can produce. The layout has already
 * established a staff session and the page re-checks the permission before
 * calling any of this (note 06 §2) — the elevated client is used only to count,
 * never to return another customer's rows into the page.
 *
 * Every count is `head: true`, so Postgres returns the number and no data.
 */

export type DashboardStats = {
  paidOrders: number;
  pendingOrders: number;
  revenue: number;
  customers: number;
  activeEntitlements: number;
  activeSubscriptions: number;
  emailsPending: number;
  emailsFailed: number;
  unreadEnquiries: number;
  draftContent: number;
};

/**
 * Count rows, optionally filtered to one column value.
 *
 * A plain column/value pair rather than a builder callback: the callback
 * version could not be typed without fighting PostgREST's builder generics,
 * and every call here is a single equality filter anyway.
 */
async function count(
  table: string,
  column?: string,
  value?: string,
): Promise<number> {
  const admin = createAdminClient();
  /*
    `"*"` rather than a named column. Counting on `id` silently returned 0 for
    `profiles`, which is keyed on `user_id` and has no `id` at all — PostgREST
    rejects the unknown column and the null count reads as zero, so the
    dashboard confidently reported "0 customers" against seven real accounts.
    With `head: true` no rows are transferred either way, so the wildcard costs
    nothing and cannot be wrong about a table's key.
  */
  const base = admin.from(table).select("*", { count: "exact", head: true });
  const { count: n } = await (column ? base.eq(column, value!) : base);
  return n ?? 0;
}

export async function dashboardStats(): Promise<DashboardStats> {
  const admin = createAdminClient();

  // Revenue has to read rows rather than count them, so it is the one query
  // that selects data — and only the one column it needs.
  const revenuePromise = admin
    .from("orders")
    .select("total")
    .eq("status", "paid")
    .then(({ data }) =>
      ((data as Array<{ total: number }> | null) ?? []).reduce(
        (sum, o) => sum + (o.total ?? 0),
        0,
      ),
    );

  const [
    paidOrders,
    pendingOrders,
    revenue,
    customers,
    activeEntitlements,
    activeSubscriptions,
    emailsPending,
    emailsFailed,
    unreadEnquiries,
    draftCatalogue,
    draftPosts,
  ] = await Promise.all([
    count("orders", "status", "paid"),
    count("orders", "status", "pending"),
    revenuePromise,
    count("profiles"),
    count("entitlements", "status", "active"),
    count("subscriptions", "status", "active"),
    count("email_messages", "status", "pending"),
    count("email_messages", "status", "failed"),
    count("contact_messages"),
    count("catalogue_items", "status", "draft"),
    count("blog_posts", "status", "draft"),
  ]);

  return {
    paidOrders,
    pendingOrders,
    revenue,
    customers,
    activeEntitlements,
    activeSubscriptions,
    emailsPending,
    emailsFailed,
    unreadEnquiries,
    draftContent: draftCatalogue + draftPosts,
  };
}

export type RecentOrder = {
  id: string;
  status: string;
  total: number;
  currency: string;
  created_at: string;
  guest_email: string | null;
  user_id: string | null;
};

/** The last few orders, newest first — the "what just happened" list. */
export async function recentOrders(limit = 6): Promise<RecentOrder[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id,status,total,currency,created_at,guest_email,user_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as RecentOrder[] | null) ?? [];
}
