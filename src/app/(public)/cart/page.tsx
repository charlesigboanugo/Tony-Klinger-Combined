import type { Metadata } from "next";
import Link from "next/link";

import {
  clearCartAction,
  removeFromCartAction,
  updateQuantityAction,
} from "@/app/(public)/cart/actions";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { readCart } from "@/lib/commerce/cart";
import { cartTotal, priceCart } from "@/lib/commerce/orders";
import { formatPrice } from "@/lib/commerce/pricing";

export const metadata: Metadata = { title: "Cart", robots: { index: false } };

/**
 * Cart — note 03 §27, note 09 §8.
 *
 * Inside the `(public)` route group so it inherits the public header and footer
 * (R10). Prices shown here are resolved server-side from the database, never
 * read from the cookie (note 09 §9).
 */
export default async function CartPage() {
  const stored = await readCart();
  const lines = await priceCart(
    stored.map((l) => ({ productSlug: l.slug, quantity: l.qty, billing: l.billing })),
  );
  const total = cartTotal(lines);
  const currency = lines[0]?.currency;

  // Stripe cannot put a subscription and a one-off in one session, so the cart
  // says so HERE rather than letting the customer discover it at the payment
  // step (note 09 §13).
  const hasRecurring = lines.some((l) => l.billingType === "recurring");
  const hasOneOff = lines.some((l) => l.billingType !== "recurring");
  const mixed = hasRecurring && hasOneOff;

  return (
    <Section>
      <Container>
        <PageHeader eyebrow="Checkout" title="Your cart" />

        {lines.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description="Courses, memberships and coaching all start in the coaching area."
            action={<ButtonLink href="/coaching">Browse coaching</ButtonLink>}
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
            <ul className="space-y-4">
              {lines.map((line) => (
                <li
                  key={line.productId}
                  className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold">
                        {line.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {formatPrice(line.unitAmount, line.currency)} each &middot;{" "}
                        {line.billingType === "recurring"
                          ? `renews every ${line.interval ?? "month"}`
                          : "one payment"}
                      </p>
                    </div>

                    <p className="font-display text-xl font-semibold tabular-nums">
                      {formatPrice(line.unitAmount * line.quantity, line.currency)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-4">
                    <form
                      action={updateQuantityAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="slug" value={line.slug} />
                      <label
                        htmlFor={`qty-${line.productId}`}
                        className="text-sm text-muted-foreground"
                      >
                        Qty
                      </label>
                      <input
                        id={`qty-${line.productId}`}
                        name="qty"
                        type="number"
                        min={0}
                        max={10}
                        defaultValue={line.quantity}
                        className="h-9 w-16 rounded-(--radius) border border-input-border bg-background px-2 text-sm"
                      />
                      <button
                        type="submit"
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Update
                      </button>
                    </form>

                    <form action={removeFromCartAction} className="ml-auto">
                      <input type="hidden" name="slug" value={line.slug} />
                      <button
                        type="submit"
                        className="text-sm text-muted-foreground underline-offset-4 hover:text-error hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card lg:sticky lg:top-24">
              <h2 className="font-display text-lg font-semibold">Summary</h2>

              <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
                <span className="font-medium">Total</span>
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {formatPrice(total, currency)}
                </span>
              </div>

              {mixed ? (
                <p
                  role="alert"
                  className="mt-4 rounded-(--radius) border border-warning bg-warning/10 p-3 text-xs"
                >
                  A membership is a subscription and has to be paid for on its
                  own. Please check it out separately from the one-off items.
                </p>
              ) : null}

              <div className="mt-5 space-y-3">
                <ButtonLink href="/checkout" size="lg" className="w-full">
                  Checkout
                </ButtonLink>
                <ButtonLink href="/coaching" variant="outline" className="w-full">
                  Continue shopping
                </ButtonLink>
              </div>

              <form action={clearCartAction} className="mt-4 text-center">
                <button
                  type="submit"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-error hover:underline"
                >
                  Empty cart
                </button>
              </form>

              <p className="mt-5 text-center text-xs text-muted-foreground">
                Prices are confirmed at checkout. You do not need an account to
                buy —{" "}
                <Link
                  href="/auth/sign-in"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  sign in
                </Link>{" "}
                if you have one.
              </p>
            </aside>
          </div>
        )}
      </Container>
    </Section>
  );
}
