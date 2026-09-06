import type { Metadata } from "next";

import { AfterPayment } from "@/app/checkout/success/AfterPayment";
import { ButtonLink } from "@/components/ui/Button";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Order complete", robots: { index: false } };

/**
 * Checkout return — note 09 §26, §27.
 *
 * This page REPORTS the order's state. It never declares payment successful on
 * its own: only the webhook can do that (note 09 §23).
 *
 * A customer can arrive here before the webhook has finished, so "processing"
 * is a first-class state rather than an error — showing failure would be wrong,
 * and showing success would be a lie.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: PageProps<"/checkout/success">) {
  const params = await searchParams;
  const orderId = typeof params.order === "string" ? params.order : null;

  let status: string | null = null;
  if (orderId) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("orders")
      .select("status")
      .eq("id", orderId)
      .maybeSingle();
    status = (data as { status: string } | null)?.status ?? null;
  }

  const paid = status === "paid";
  const failed = status === "failed" || status === "cancelled";
  const state = paid ? "paid" : failed ? "failed" : "processing";

  return (
    <div className="space-y-6 py-10 text-center">
      {/* Clears the cart on success and polls while the webhook lands. */}
      <AfterPayment status={state} />

      <p
        className={
          paid
            ? "text-xs font-semibold tracking-[0.18em] text-success uppercase"
            : failed
              ? "text-xs font-semibold tracking-[0.18em] text-error uppercase"
              : "text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase"
        }
      >
        {paid ? "Payment confirmed" : failed ? "Payment problem" : "Processing"}
      </p>

      <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
        {paid
          ? "Thank you — your order is complete"
          : failed
            ? "That payment didn't go through"
            : "We're confirming your payment"}
      </h1>

      <p className="mx-auto max-w-md text-pretty text-muted-foreground">
        {paid
          ? "Your access has been set up. If you checked out as a guest, we've emailed you a link to claim it."
          : failed
            ? "No money has been taken. You can try again from the product page."
            : "This usually takes a few seconds. You can safely refresh this page — your payment is already with our provider, and your order is saved either way."}
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        {paid ? (
          <>
            <ButtonLink href="/academy">Go to the Academy</ButtonLink>
            <ButtonLink href="/account/orders" variant="outline">
              View order
            </ButtonLink>
          </>
        ) : (
          <ButtonLink href="/coaching" variant="outline">
            Back to coaching
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
