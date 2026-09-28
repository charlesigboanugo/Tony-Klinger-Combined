import "server-only";

import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * One Stripe Customer per account — migration 0021.
 *
 * Cards, invoices, subscriptions and the Customer Portal all hang off a
 * Customer. Checkout used to send only an email, so Stripe made a fresh
 * customer per subscription (or none for a one-off payment) and there was no
 * single record to open a portal on. Every signed-in checkout now names this
 * customer instead.
 *
 * Service role throughout: `billing_customers` has no write policy, so a
 * customer can never point their account at someone else's Stripe record.
 */

/** The stored customer id, or null. Never creates one. */
export async function storedCustomerId(userId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.stripe_customer_id ?? null;
}

/** Remember a customer for an account. The first one recorded wins. */
export async function rememberCustomer(userId: string, customerId: string): Promise<void> {
  await createAdminClient()
    .from("billing_customers")
    .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id", ignoreDuplicates: true });
}

/**
 * The account's Stripe Customer, found or created.
 *
 *   1. already stored
 *   2. the customer behind an existing subscription (members who subscribed
 *      before customers were stored)
 *   3. a new customer, created idempotently so two tabs cannot make two
 */
export async function ensureStripeCustomer(userId: string, email: string): Promise<string> {
  const stored = await storedCustomerId(userId);
  if (stored) return stored;

  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("provider_subscription_id")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let customerId: string | null = null;
  if (sub?.provider_subscription_id) {
    try {
      const subscription = await stripe().subscriptions.retrieve(sub.provider_subscription_id);
      customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    } catch {
      customerId = null; // A subscription Stripe no longer knows: fall through and create.
    }
  }

  if (!customerId) {
    const customer = await stripe().customers.create(
      { email, metadata: { user_id: userId } },
      { idempotencyKey: `customer:${userId}` },
    );
    customerId = customer.id;
  }

  await rememberCustomer(userId, customerId);
  // Re-read: if another request stored one first, use theirs.
  return (await storedCustomerId(userId)) ?? customerId;
}
