"use server";

import { revalidatePath } from "next/cache";

import { isBillingPeriod } from "@/lib/commerce/billing";
import { addLine, readCart, setLineBilling, switchLine, writeCart } from "@/lib/commerce/cart";
import { optionsForProducts } from "@/lib/commerce/options";

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

  const lines = await readCart();

  // Already there: adding again is not a way to buy two (owner, 2026-10-08).
  // The product page offers "Remove" in its place; this is the guard behind it.
  if (lines.some((l) => l.slug === slug)) return;

  // Another option of the same offer is there (one session, and this is the
  // pack of eight): one offer is one line, so it is changed, not added to.
  const sibling = ((await optionsForProducts([slug])).get(slug) ?? [])
    .map((o) => o.slug)
    .find((other) => other !== slug && lines.some((l) => l.slug === other));

  await writeCart(sibling ? switchLine(lines, sibling, slug) : addLine(lines, slug, billing));
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

/**
 * Change a line to another option of the same offer (one session ↔ eight,
 * Level 1 ↔ Level 2), without removing it and finding the other product.
 *
 * The target is accepted only if the database says it is an alternative of the
 * line being changed, so this cannot be used to put an arbitrary product in
 * the cart — and prices are re-resolved at checkout regardless (note 09 §9).
 */
export async function switchCartOptionAction(formData: FormData) {
  const from = formData.get("slug")?.toString();
  const to = formData.get("to")?.toString();
  if (!from || !to || from === to) return;

  const options = (await optionsForProducts([from])).get(from) ?? [];
  if (!options.some((o) => o.slug === to)) return;

  await writeCart(switchLine(await readCart(), from, to));
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
