import "server-only";

import { codeLabel } from "@/lib/admin/labels";
import { createAdminClient } from "@/lib/supabase/admin";
import { timeAgo } from "@/lib/utils/device";
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
  "event", "group_coaching_session", "private_coaching", "cohort_workshop", "retreat",
];
/** What admin's Bookings covers: events and one-to-one coaching (owner, 2026-10-14). */
export const BOOKINGS_TYPES: readonly BookableType[] = ["event", "private_coaching"];
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

export type Person = {
  id: string;
  name: string | null;
  email: string | null;
  /** When the account last signed in (not when it was last active); null if never. */
  lastSignInAt: string | null;
  /** The same in words, "2 days ago"; null if never. */
  lastSignInAgo: string | null;
};

/**
 * The auth records for a set of accounts.
 *
 * For more than a handful it asks for the account list once (a thousand per
 * call) and picks from it, instead of one request per account: a page of two
 * hundred rows was two hundred round trips. Any id not in that first thousand
 * is still fetched on its own, so nothing is missed on a larger site.
 */
async function authUsersByIds(ids: string[]) {
  const admin = createAdminClient();
  const one = (id: string) => admin.auth.admin.getUserById(id).then((r) => r.data.user);
  if (ids.length <= 5) return Promise.all(ids.map(one));

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const listed = new Map((data?.users ?? []).map((u) => [u.id, u]));
  return Promise.all(ids.map((id) => listed.get(id) ?? one(id)));
}

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
    authUsersByIds(unique),
  ]);

  const nameOf = new Map(
    (profiles ?? []).map((p) => [
      p.user_id,
      p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
    ]),
  );
  const now = Date.now();
  for (const id of unique) {
    const user = users.find((u) => u?.id === id);
    people.set(id, {
      id,
      name: nameOf.get(id) ?? null,
      email: user?.email ?? null,
      lastSignInAt: user?.last_sign_in_at ?? null,
      lastSignInAgo: timeAgo(user?.last_sign_in_at, now, "always"),
    });
  }
  return people;
}

/**
 * The account that holds an email address, or null.
 *
 * So staff can type the address they know, not a uuid copied from another
 * page (owner, 2026-10-13). An email is unique to one account. Exact match,
 * ignoring case; reads the account list a thousand at a time.
 */
export async function userIdForEmail(email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  if (!wanted) return null;
  const admin = createAdminClient();
  for (let page = 1; page <= 5; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const found = users.find((u) => u.email?.toLowerCase() === wanted);
    if (found) return found.id;
    if (users.length < 1000) break;
  }
  return null;
}

/** Whether a field or column holds an account's id. */
export function isUserColumn(name: string): boolean {
  return name === "user_id" || name.endsWith("_user_id");
}

/**
 * Why an account cannot be deleted yet, in words staff can act on; empty
 * when it can be — note 06 §14.4.
 *
 * Deleting an account removes the person's access, bookings, registrations
 * and history with it (those rows cascade), so it is refused while any of
 * that is still LIVE: staff roles, access in force, a place still to come, a
 * subscription still charging.
 *
 * AND IT IS REFUSED FOR ANYONE WHO HAS EVER ORDERED (owner, 2026-10-14: not
 * one "with something/running purchases"). The database requires every order
 * to keep either its account or an email (`orders_have_an_owner_or_an_email`),
 * and a signed-in order carries no email of its own, so deleting the account
 * would fail at the database anyway. Keeping such accounts keeps the purchase
 * records whole; deletion is for accounts that never bought anything.
 */
export async function accountDeletionBlockers(userId: string): Promise<string[]> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const [roles, access, bookings, subscriptions, orders] = await Promise.all([
    admin.from("user_roles").select("roles(name)").eq("user_id", userId),
    admin
      .from("entitlements")
      .select("resource_type", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["pending", "confirmed"])
      .or(`starts_at.is.null,starts_at.gt.${now}`),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["trialing", "active", "past_due", "incomplete"]),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const blockers: string[] = [];
  const roleNames = ((roles.data ?? []) as unknown as Array<{ roles: { name: string } | null }>)
    .map((r) => r.roles?.name)
    .filter((n): n is string => Boolean(n));
  if (roleNames.length) {
    blockers.push(
      `Holds the role${roleNames.length === 1 ? "" : "s"} ${roleNames.map((r) => r.replace(/_/g, " ")).join(", ")}. Revoke ${roleNames.length === 1 ? "it" : "them"} under Roles first.`,
    );
  }
  const accessCount = access.count ?? 0;
  if (accessCount) {
    const kinds = [...new Set((access.data ?? []).map((e) => codeLabel(e.resource_type)))];
    blockers.push(
      `Has ${accessCount} piece${accessCount === 1 ? "" : "s"} of access still in force (${kinds.join(", ")}). Revoke ${accessCount === 1 ? "it" : "them"} under Access, or wait until ${accessCount === 1 ? "it ends" : "they end"}.`,
    );
  }
  if (bookings.count) {
    blockers.push(
      `Has ${bookings.count} booking${bookings.count === 1 ? "" : "s"} still to come. Cancel ${bookings.count === 1 ? "it" : "them"} first.`,
    );
  }
  if (subscriptions.count) {
    blockers.push("Has a subscription that is still running. Cancel it in Stripe first.");
  }
  if (orders.count) {
    blockers.push(
      `Has ${orders.count} order${orders.count === 1 ? "" : "s"}. An account that has bought anything is kept, so its purchase records stay complete.`,
    );
  }
  return blockers;
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
  const payments = data ?? [];

  // Who paid: a payment has no customer of its own, its order does. Read in
  // batches, because a thousand ids do not fit in one request's address.
  const orderIds = [...new Set(payments.map((p) => p.order_id).filter((id): id is string => Boolean(id)))];
  const batches: string[][] = [];
  for (let i = 0; i < orderIds.length; i += 150) batches.push(orderIds.slice(i, i + 150));
  const found = await Promise.all(
    batches.map((ids) => admin.from("orders").select("id,user_id,guest_email").in("id", ids)),
  );
  const orderOf = new Map(found.flatMap((r) => r.data ?? []).map((o) => [o.id, o]));

  return payments.map((p) => {
    const order = p.order_id ? orderOf.get(p.order_id) : undefined;
    return { ...p, user_id: order?.user_id ?? null, guest_email: order?.guest_email ?? null };
  });
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
  request = filter.type ? request.eq("bookable_type", filter.type) : request.in("bookable_type", [...BOOKINGS_TYPES]);
  if (filter.status) request = request.eq("status", filter.status);

  const [{ data }, counts] = await Promise.all([request, countBy("bookings", "bookable_type", BOOKABLE_TYPES)]);
  // "All" means all that Bookings covers, not every booking in the table.
  counts.all = BOOKINGS_TYPES.reduce((sum, t) => sum + counts[t], 0);
  const rows = (data ?? []) as Array<Omit<AdminBooking, "title">>;

  // `bookable_id` is polymorphic, so titles are resolved per type.
  const ids = (type: BookableType) => rows.filter((r) => r.bookable_type === type).map((r) => r.bookable_id);
  const titles = new Map<string, string>();
  const [events, sessions, slots, workshops, retreats] = await Promise.all([
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
    // `name`, not `title`: retreats have no title column, so this read failed
    // and every retreat booking was listed as plain "Retreat".
    ids("retreat").length ? admin.from("retreats").select("id,name").in("id", ids("retreat")) : null,
  ]);
  for (const e of events?.data ?? []) titles.set(e.id, e.name);
  for (const s of sessions?.data ?? []) titles.set(s.id, s.title);
  for (const s of (slots?.data ?? []) as unknown as Array<{ id: string; private_coaching_services: { name: string } | null }>) {
    titles.set(s.id, s.private_coaching_services?.name ?? "Private coaching");
  }
  for (const w of workshops?.data ?? []) titles.set(w.id, w.title);
  for (const r of retreats?.data ?? []) titles.set(r.id, r.name);

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
