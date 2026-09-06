"use server";

import { revalidatePath } from "next/cache";

import { isBillingPeriod } from "@/lib/commerce/billing";
import { addLine, readCart, setLineBilling, writeCart } from "@/lib/commerce/cart";

/**
 * Cart mutations — UI-triggered, so Server Actions rather than Route Handlers
 * (note 02 §21).
 */
export async function addToCartAction(formData: FormData) {
  const slug = formData.get("slug")?.toString();
  if (!slug) return;

  // The chosen billing period travels with the line, so a membership added as
  // "one year" is not silently re-priced monthly at checkout (note 09 §16.1).
  const raw = formData.get("billing")?.toString();
  const billing = isBillingPeriod(raw) ? raw : undefined;

  await writeCart(addLine(await readCart(), slug, 1, billing));
  revalidatePath("/cart");
}

/** Change how an item already in the cart is billed, without removing it. */
export async function setCartBillingAction(formData: FormData) {
  const slug = formData.get("slug")?.toString();
  const raw = formData.get("billing")?.toString();
  if (!slug || !isBillingPeriod(raw)) return;

  await writeCart(setLineBilling(await readCart(), slug, raw));
  revalidatePath("/cart");
}

export async function updateQuantityAction(formData: FormData) {
  const slug = formData.get("slug")?.toString();
  const qty = Number(formData.get("qty"));
  if (!slug || !Number.isFinite(qty)) return;

  const lines = await readCart();
  await writeCart(
    qty <= 0
      ? lines.filter((l) => l.slug !== slug)
      : lines.map((l) => (l.slug === slug ? { ...l, qty } : l)),
  );
  revalidatePath("/cart");
}

export async function removeFromCartAction(formData: FormData) {
  const slug = formData.get("slug")?.toString();
  if (!slug) return;

  await writeCart((await readCart()).filter((l) => l.slug !== slug));
  revalidatePath("/cart");
}

export async function clearCartAction() {
  await writeCart([]);
  revalidatePath("/cart");
}
