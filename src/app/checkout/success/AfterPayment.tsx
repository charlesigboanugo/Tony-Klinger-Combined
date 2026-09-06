"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { clearCartAction } from "@/app/(public)/cart/actions";

/**
 * Two jobs the success page cannot do by itself.
 *
 * 1. EMPTY THE CART ONCE PAYMENT IS CONFIRMED. Nothing was clearing it, so a
 *    customer who checked out from the cart still had every item sitting in it
 *    afterwards — and would have been able to buy the whole basket a second
 *    time. It is cleared here, on `paid`, rather than when the Stripe session
 *    is created: clearing it earlier would empty the cart of somebody who then
 *    cancelled at the payment step and came back expecting their basket.
 *
 *    A cookie cannot be written while rendering a Server Component, which is
 *    why this is a client island calling a Server Action rather than a few
 *    lines in the page.
 *
 * 2. POLL WHILE PROCESSING. A customer can arrive before the webhook has
 *    finished (note 09 §27), and telling them to refresh by hand is the sort of
 *    unfinished edge that makes a payment feel unsafe. It re-checks a few times
 *    and then stops — an indefinite poll on a stuck order is just load.
 */
export function AfterPayment({ status }: { status: "paid" | "processing" | "failed" }) {
  const router = useRouter();
  const cleared = useRef(false);
  const attempts = useRef(0);

  useEffect(() => {
    if (status !== "paid" || cleared.current) return;
    cleared.current = true;
    void clearCartAction();
  }, [status]);

  useEffect(() => {
    if (status !== "processing") return;

    const id = window.setInterval(() => {
      attempts.current += 1;
      // ~30 seconds of polling. Beyond that the reconciliation job (note 09
      // §44) is the safety net, and the page already says the order is saved.
      if (attempts.current > 10) {
        window.clearInterval(id);
        return;
      }
      router.refresh();
    }, 3000);

    return () => window.clearInterval(id);
  }, [status, router]);

  return null;
}
