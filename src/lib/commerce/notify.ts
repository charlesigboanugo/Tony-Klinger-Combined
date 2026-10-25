import "server-only";

import type Stripe from "stripe";

import { issueClaimToken } from "@/lib/commerce/claim";
import { recordCustomer } from "@/lib/email/audience";
import { queueEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The emails a paid order sends — note 09 §42, note 05 §29.3.
 *
 * ONE PLACE, used by the Stripe webhook and by the reconciliation job that
 * stands in for a webhook that never arrived. The two used to carry a copy
 * each, and they had drifted: for a gift recovered by the job, the claim link
 * went to the payer instead of the recipient (found in the end-to-end test,
 * 2026-10-23).
 *
 *   claim link   an order with no account yet (a guest's, or a gift): to the
 *                ORDER's email, which for a gift is the recipient's
 *   receipt      always, to whoever paid (the email Stripe collected). Guest
 *                and gift buyers used to get none (owner, 2026-10-23)
 *
 * THE IDEMPOTENCY KEYS (`claim:`, `receipt:` + order id) are what make running
 * both paths safe: whichever reaches `enqueue_email` first wins, and the other
 * queues nothing. Returns how many emails this call newly queued.
 */
export async function notifyPaidOrder(
  orderId: string,
  session: Stripe.Checkout.Session,
  claimed: boolean | undefined,
): Promise<number> {
  const payer = session.customer_details?.email ?? session.customer_email;
  let queued = 0;

  if (claimed === false) {
    const claim = await issueClaimToken(orderId);
    const { data: owner } = await createAdminClient()
      .from("orders")
      .select("guest_email,is_gift,order_items(product_name_snapshot)")
      .eq("id", orderId)
      .maybeSingle();
    // The claim link IS the credential, so it goes only to the order's own
    // address, never to whoever happens to be paying for someone else.
    const claimTo = owner?.guest_email ?? payer;
    if (claim && claimTo) {
      if (
        await queueEmail({
          idempotencyKey: `claim:${orderId}`,
          template: "guest_claim",
          to: claimTo,
          payload: {
            // `gift=1` only words the claim page for a recipient; the token
            // alone decides what is claimed.
            claimUrl: owner?.is_gift ? `${claim.url}&gift=1` : claim.url,
            expiresAt: claim.expiresAt,
            gift: owner?.is_gift ?? false,
            items: (owner?.order_items ?? []).map((i) => i.product_name_snapshot).join(", "),
          },
        })
      ) {
        queued += 1;
      }
    }
  }

  if (payer) {
    // Soft opt-in: details obtained in the course of a sale. The opt-out shown
    // at checkout and in every message is what makes this lawful, and
    // recordCustomer skips anyone who has opted out. It is the PAYER, for a
    // guest or gift order too (owner, 2026-10-25): they bought and saw the
    // notice. Never a gift's recipient, who did neither.
    await recordCustomer(payer);

    if (
      await queueEmail({
        idempotencyKey: `receipt:${orderId}`,
        template: "order_receipt",
        to: payer,
        payload: {
          total: session.amount_total ?? 0,
          currency: (session.currency ?? "gbp").toUpperCase(),
        },
      })
    ) {
      queued += 1;
    }
  }

  return queued;
}
