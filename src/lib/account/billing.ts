import "server-only";

import type Stripe from "stripe";

import { getAuthContext } from "@/lib/permissions";
import { stripe } from "@/lib/stripe/client";
import { storedCustomerId } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Billing reads for /account/billing and the order pages — migration 0021,
 * note 09 §16.1, §17.
 *
 * Our tables hold what was bought and paid; Stripe holds the card. The card
 * summary is read live from Stripe (it is never stored here — note 09 §48),
 * and a Stripe outage degrades to "unavailable" rather than breaking the page.
 * Every read is filtered to the caller as well as by RLS (note 08 §60).
 */

export type MembershipBilling = {
  id: string;
  providerId: string;
  tier: string | null;
  status: string;
  periodEnd: string | null;
  cancelAt: string | null;
  cancelling: boolean;
};

export type CardSummary = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type HistoryEntry = {
  id: string;
  date: string;
  title: string;
  amount: number;
  currency: string;
  status: "paid" | "failed" | "open" | "refunded" | "void";
  /** Stripe-hosted receipt or invoice page. */
  receiptUrl: string | null;
  pdfUrl: string | null;
  orderId: string | null;
};

export async function myMemberships(): Promise<MembershipBilling[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id,provider_subscription_id,membership_tier,status,current_period_end,cancel_at,cancel_at_period_end")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((s) => ({
    id: s.id,
    providerId: s.provider_subscription_id,
    tier: s.membership_tier,
    status: s.status,
    periodEnd: s.current_period_end,
    cancelAt: s.cancel_at,
    cancelling: s.cancel_at_period_end || s.cancel_at != null,
  }));
}

/**
 * The card Stripe will charge next: the customer's default, else the one on
 * their subscription, else the most recent card saved. Null when there is no
 * customer or no card; "unavailable" when Stripe could not be reached.
 */
export async function myCard(): Promise<CardSummary | null | "unavailable"> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return null;
  const customerId = await storedCustomerId(userId);
  if (!customerId) return null;

  const toSummary = (pm: Stripe.PaymentMethod | string | null | undefined): CardSummary | null =>
    pm && typeof pm !== "string" && pm.card
      ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year }
      : null;

  try {
    const customer = await stripe().customers.retrieve(customerId, {
      expand: ["invoice_settings.default_payment_method"],
    });
    if (customer.deleted) return null;
    const fromDefault = toSummary(customer.invoice_settings?.default_payment_method);
    if (fromDefault) return fromDefault;

    const subs = await stripe().subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 1,
      expand: ["data.default_payment_method"],
    });
    const fromSubscription = toSummary(subs.data[0]?.default_payment_method);
    if (fromSubscription) return fromSubscription;

    const cards = await stripe().paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    return toSummary(cards.data[0]);
  } catch (error) {
    console.error("card lookup failed", { message: error instanceof Error ? error.message : "unknown" });
    return "unavailable";
  }
}

/**
 * Everything charged, newest first: one-off orders (with their receipt) and
 * every subscription invoice — the first payment and each renewal. A
 * subscription's checkout order is represented by its invoice, not twice.
 */
export async function myPaymentHistory(): Promise<HistoryEntry[]> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return [];
  const supabase = await createClient();

  const [{ data: orders }, { data: invoices }] = await Promise.all([
    supabase
      .from("orders")
      .select("id,status,currency,total,created_at,paid_at,order_items(product_name_snapshot,quantity),payments(receipt_url)")
      .eq("user_id", userId)
      .eq("checkout_mode", "payment")
      .in("status", ["paid", "refunded"])
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id,order_id,number,status,amount_due,amount_paid,currency,hosted_invoice_url,invoice_pdf,period_start,period_end,paid_at,created_at,membership_tier,subscriptions(membership_tier)")
      .eq("user_id", userId)
      .in("status", ["paid", "open", "uncollectible", "void"])
      .order("created_at", { ascending: false }),
  ]);

  type OrderRow = {
    id: string;
    status: string;
    currency: string;
    total: number;
    created_at: string;
    paid_at: string | null;
    order_items: Array<{ product_name_snapshot: string; quantity: number }>;
    payments: Array<{ receipt_url: string | null }>;
  };
  type InvoiceRow = {
    id: string;
    order_id: string | null;
    number: string | null;
    status: string;
    amount_due: number;
    amount_paid: number;
    currency: string;
    hosted_invoice_url: string | null;
    invoice_pdf: string | null;
    paid_at: string | null;
    created_at: string;
    membership_tier: string | null;
    subscriptions: { membership_tier: string | null } | null;
  };

  const fromOrders: HistoryEntry[] = ((orders ?? []) as unknown as OrderRow[]).map((o) => {
    const [first, ...more] = o.order_items ?? [];
    return {
      id: `order:${o.id}`,
      date: o.paid_at ?? o.created_at,
      title: first ? first.product_name_snapshot + (more.length ? ` and ${more.length} more` : "") : "Order",
      amount: o.total,
      currency: o.currency,
      status: o.status === "refunded" ? "refunded" : "paid",
      receiptUrl: o.payments?.find((p) => p.receipt_url)?.receipt_url ?? null,
      pdfUrl: null,
      orderId: o.id,
    };
  });

  const fromInvoices: HistoryEntry[] = ((invoices ?? []) as unknown as InvoiceRow[]).map((i) => {
    const tier = i.membership_tier ?? i.subscriptions?.membership_tier;
    const label = tier ? `${tier[0].toUpperCase()}${tier.slice(1)} membership` : "Membership";
    return {
      id: `invoice:${i.id}`,
      date: i.paid_at ?? i.created_at,
      title: i.order_id ? label : `${label} renewal`,
      amount: i.status === "paid" ? i.amount_paid : i.amount_due,
      currency: i.currency,
      status: i.status === "paid" ? "paid" : i.status === "void" ? "void" : i.status === "open" ? "open" : "failed",
      receiptUrl: i.hosted_invoice_url,
      pdfUrl: i.invoice_pdf,
      orderId: i.order_id,
    };
  });

  return [...fromOrders, ...fromInvoices].sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/**
 * The receipt for one of the caller's orders: the invoice for a subscription
 * order, otherwise Stripe's charge receipt. A paid order whose receipt was not
 * captured when it was fulfilled (a Stripe hiccup, or paid before receipts
 * were stored) is looked up once now and remembered.
 */
export async function receiptForOrder(
  orderId: string,
): Promise<{ receiptUrl: string | null; pdfUrl: string | null } | null> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return null;
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id,status,checkout_mode,payments(id,provider,provider_payment_id,receipt_url),invoices(hosted_invoice_url,invoice_pdf)")
    .eq("id", orderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!order || (order.status !== "paid" && order.status !== "refunded")) return null;

  const row = order as unknown as {
    checkout_mode: string;
    payments: Array<{ id: string; provider: string; provider_payment_id: string; receipt_url: string | null }>;
    invoices: Array<{ hosted_invoice_url: string | null; invoice_pdf: string | null }>;
  };

  if (row.checkout_mode === "subscription") {
    const invoice = row.invoices?.[0];
    return invoice ? { receiptUrl: invoice.hosted_invoice_url, pdfUrl: invoice.invoice_pdf } : null;
  }

  const payment = row.payments?.[0];
  if (!payment) return null;
  if (payment.receipt_url) return { receiptUrl: payment.receipt_url, pdfUrl: null };
  if (payment.provider !== "stripe" || !payment.provider_payment_id.startsWith("pi_")) return null;

  try {
    const intent = await stripe().paymentIntents.retrieve(payment.provider_payment_id, { expand: ["latest_charge"] });
    const receiptUrl = (intent.latest_charge as Stripe.Charge | null)?.receipt_url ?? null;
    if (receiptUrl) {
      await createAdminClient().from("payments").update({ receipt_url: receiptUrl }).eq("id", payment.id);
    }
    return { receiptUrl, pdfUrl: null };
  } catch {
    return null;
  }
}
