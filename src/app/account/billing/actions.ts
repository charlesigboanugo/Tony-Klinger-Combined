"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type Stripe from "stripe";

import { getAuthContext } from "@/lib/permissions";
import { stripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { absoluteUrl } from "@/lib/urls";

/**
 * Billing self-service — migration 0021, note 09 §17.
 *
 * Card changes, invoice history and billing details run in the Stripe
 * Customer Portal: Stripe's own, PCI-scoped pages. "Update card" deep-links
 * straight to that step (`flow_data`); "Manage in Stripe" opens the portal
 * home, where cancelling is offered too. Changes made there come back through
 * the subscription webhooks.
 *
 * Cancelling can ALSO be done right here (owner, 2026-09-27: "cancelling can
 * be done directly through the dashboard and on Stripe"), with its own
 * confirmation dialog. Resuming a membership that is set to cancel has no
 * portal deep link, so it is only done here.
 *
 * The browser names only a subscription row id; ownership is checked against
 * the signed-in account before Stripe is called (note 05 §31).
 */

const BILLING = "/account/billing";

async function ownSubscription(userId: string, subscriptionRowId: string | undefined) {
  if (!subscriptionRowId) return null;
  const { data } = await createAdminClient()
    .from("subscriptions")
    .select("id,provider_subscription_id,status,cancel_at,cancel_at_period_end")
    .eq("id", subscriptionRowId)
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .maybeSingle();
  return data;
}

export async function openBillingPortalAction(formData: FormData): Promise<void> {
  const context = await getAuthContext();
  if (!context?.email) redirect(`/auth/sign-in?next=${BILLING}`);

  const flow = formData.get("flow")?.toString() ?? "home";
  const returnUrl = absoluteUrl(`${BILLING}?updated=1`);

  let flowData: Stripe.BillingPortal.SessionCreateParams.FlowData | undefined;
  if (flow === "payment_method") {
    flowData = {
      type: "payment_method_update",
      after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
    };
  }

  let url: string;
  try {
    const customer = await ensureStripeCustomer(context.userId, context.email);
    const session = await stripe().billingPortal.sessions.create({
      customer,
      return_url: absoluteUrl(BILLING),
      // Set in production to the configuration made by
      // scripts/stripe-portal-setup.mjs; without it Stripe uses the account's
      // default portal settings.
      ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
        : {}),
      ...(flowData ? { flow_data: flowData } : {}),
    });
    url = session.url;
  } catch (error) {
    console.error("billing portal failed", { flow, message: error instanceof Error ? error.message : "unknown" });
    redirect(`${BILLING}?error=portal`);
  }

  redirect(url);
}

/** Stripe's own cancellation reasons, so they show in its churn reporting. */
const REASONS = new Set([
  "too_expensive",
  "unused",
  "missing_features",
  "switched_service",
  "too_complex",
  "low_quality",
  "customer_service",
  "other",
]);

/**
 * Cancel on the site, at the end of the paid period — the same outcome as the
 * portal's cancel step (which stays available): access runs to the date
 * already paid for and nothing more is charged (note 09 §16.1). The optional
 * reason and comment go to Stripe as `cancellation_details`.
 */
export async function cancelMembershipAction(formData: FormData): Promise<void> {
  const context = await getAuthContext();
  if (!context) redirect(`/auth/sign-in?next=${BILLING}`);

  const sub = await ownSubscription(context.userId, formData.get("subscription")?.toString());
  if (!sub || !["active", "trialing", "past_due"].includes(sub.status)) redirect(`${BILLING}?error=subscription`);
  if (sub.cancel_at_period_end || sub.cancel_at) redirect(`${BILLING}?cancelled=1`);

  const reason = formData.get("reason")?.toString() ?? "";
  const comment = formData.get("comment")?.toString().trim().slice(0, 500) ?? "";

  try {
    const updated = await stripe().subscriptions.update(sub.provider_subscription_id, {
      cancel_at_period_end: true,
      ...(REASONS.has(reason) || comment
        ? {
            cancellation_details: {
              ...(REASONS.has(reason)
                ? { feedback: reason as Stripe.SubscriptionUpdateParams.CancellationDetails.Feedback }
                : {}),
              ...(comment ? { comment } : {}),
            },
          }
        : {}),
    });

    // Shown straight away; the subscription webhook confirms the same values.
    const periodEnd = updated.items?.data?.[0]?.current_period_end;
    await createAdminClient()
      .from("subscriptions")
      .update({
        cancel_at_period_end: true,
        cancel_at: updated.cancel_at
          ? new Date(updated.cancel_at * 1000).toISOString()
          : periodEnd
            ? new Date(periodEnd * 1000).toISOString()
            : null,
      })
      .eq("id", sub.id);
  } catch (error) {
    console.error("cancel failed", { message: error instanceof Error ? error.message : "unknown" });
    redirect(`${BILLING}?error=cancel`);
  }

  revalidatePath(BILLING);
  revalidatePath("/account/memberships");
  redirect(`${BILLING}?cancelled=1`);
}

export async function resumeMembershipAction(formData: FormData): Promise<void> {
  const context = await getAuthContext();
  if (!context) redirect(`/auth/sign-in?next=${BILLING}`);

  const sub = await ownSubscription(context.userId, formData.get("subscription")?.toString());
  if (!sub || !(sub.cancel_at_period_end || sub.cancel_at)) redirect(`${BILLING}?error=subscription`);

  try {
    // Stripe records a cancellation either as "at period end" or as a date,
    // and refuses an update that names both — so clear whichever it holds.
    const current = await stripe().subscriptions.retrieve(sub.provider_subscription_id);
    const updated = await stripe().subscriptions.update(
      sub.provider_subscription_id,
      current.cancel_at_period_end ? { cancel_at_period_end: false } : { cancel_at: "" },
    );

    // Shown straight away; the subscription webhook confirms the same values.
    await createAdminClient()
      .from("subscriptions")
      .update({ cancel_at: null, cancel_at_period_end: updated.cancel_at_period_end || updated.cancel_at != null })
      .eq("id", sub.id);
  } catch (error) {
    console.error("resume failed", { message: error instanceof Error ? error.message : "unknown" });
    redirect(`${BILLING}?error=resume`);
  }

  revalidatePath(BILLING);
  revalidatePath("/account/memberships");
  redirect(`${BILLING}?resumed=1`);
}
