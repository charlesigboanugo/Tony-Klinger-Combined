"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPendingOrder, priceCart } from "@/lib/commerce/orders";
import { stripe } from "@/lib/stripe/client";
import { ensureStripeCustomer } from "@/lib/stripe/customer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { absoluteUrl } from "@/lib/urls";

/**
 * Book a private coaching slot — migration 0020, note 09 §35 (book-first).
 *
 *   1. `hold_private_coaching_slot` locks the slot. With an unspent session
 *      (a credit) it books outright and we are done.
 *   2. Otherwise it returns a hold, and the customer pays for the service's
 *      product in a Stripe Checkout that lives no longer than the hold.
 *   3. The webhook fulfils the order; the entitlement it grants confirms the
 *      held booking in the database (never here — note 09 §23).
 *
 * The browser names only the slot. The service, product and price are all
 * read from the database (note 09 §9).
 */
export type PrivateBookingState = { error?: string };

const MESSAGES: Record<string, string> = {
  taken: "Someone has just taken that time. Please choose another.",
  past: "That time is too soon to book now. Please choose another.",
  not_found: "That time is no longer available. Please choose another.",
  not_authenticated: "Please sign in to book.",
};

/** Stripe's shortest Checkout lifetime. The database hold outlasts it by five minutes. */
const CHECKOUT_MINUTES = 30;

export async function bookPrivateSlotAction(
  _prev: PrivateBookingState,
  formData: FormData,
): Promise<PrivateBookingState> {
  const slotId = formData.get("slotId")?.toString();
  if (!slotId) return { error: "Choose a time first." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: MESSAGES.not_authenticated };

  const { data, error } = await supabase.rpc("hold_private_coaching_slot", {
    p_slot_id: slotId,
    p_hold_minutes: CHECKOUT_MINUTES + 5,
  });
  if (error) return { error: "We couldn't hold that time. Please try again." };

  const result = data as { status: string; booking_id?: string; service_id?: string } | null;

  if (result?.status === "booked") {
    revalidatePath("/account/bookings");
    revalidatePath("/academy");
    revalidatePath("/academy/coaching");
    redirect("/academy/coaching?booked=private");
  }

  if (result?.status !== "held" || !result.booking_id || !result.service_id) {
    return { error: MESSAGES[result?.status ?? "not_found"] ?? MESSAGES.not_found };
  }

  const admin = createAdminClient();
  const release = () =>
    admin
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), hold_expires_at: null })
      .eq("id", result.booking_id!);

  // The product that sells this service, and its price, from our own tables.
  const { data: service } = await supabase
    .from("private_coaching_services")
    .select("products(slug)")
    .eq("id", result.service_id)
    .maybeSingle();
  const embedded = (service as { products?: { slug: string } | Array<{ slug: string }> | null } | null)?.products;
  const productSlug = Array.isArray(embedded) ? embedded[0]?.slug : embedded?.slug;

  const lines = productSlug ? await priceCart([{ productSlug, quantity: 1 }]) : [];
  if (lines.length === 0) {
    await release();
    return { error: "This session isn't available to buy online just now. Please get in touch." };
  }

  const order = await createPendingOrder({ userId: user.id, guestEmail: null, lines });
  if (!order) {
    await release();
    return { error: "We couldn't start checkout. Please try again." };
  }

  // The hold knows its order, so fulfilment can find the booking to confirm.
  await admin.from("bookings").update({ order_id: order.orderId }).eq("id", result.booking_id);

  let url: string | null = null;
  try {
    const line = lines[0];
    const customer = await ensureStripeCustomer(user.id, user.email);
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer,
      line_items: [
        line.stripePriceId
          ? { quantity: 1, price: line.stripePriceId }
          : {
              quantity: 1,
              price_data: {
                currency: line.currency.toLowerCase(),
                unit_amount: line.unitAmount,
                product_data: { name: line.name },
              },
            },
      ],
      metadata: { order_id: order.orderId },
      // Ends before the hold does, so nobody can pay for a time that has
      // already been released to someone else.
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60 + 30,
      success_url: absoluteUrl(`/checkout/success?order=${order.orderId}`),
      cancel_url: absoluteUrl(`/checkout/cancel?order=${order.orderId}`),
    });
    url = session.url;

    await admin.from("orders").update({ external_reference: session.id }).eq("id", order.orderId);
  } catch {
    await release();
    return { error: "Payments are unavailable right now. Please try again shortly." };
  }

  if (!url) {
    await release();
    return { error: "We couldn't reach the payment provider." };
  }

  redirect(url);
}
