import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutForm } from "@/app/checkout/CheckoutForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isBillingPeriod } from "@/lib/commerce/billing";
import { readCart } from "@/lib/commerce/cart";
import { priceCart } from "@/lib/commerce/orders";
import { formatPrice } from "@/lib/commerce/pricing";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

/**
 * Checkout — note 03 §28, note 09 §4.
 *
 * No session required: guest checkout is supported (R12). The items come from
 * the query string or the cart, but every PRICE is resolved server-side
 * (note 09 §9).
 *
 * TWO ENTRY POINTS, one page:
 *
 *   buy-now   /checkout?membership=…  a single product from a detail page
 *   cart      /checkout               everything in the cart
 *
 * The cart route did not previously exist. `/checkout` read only a single slug
 * from the query string, so the cart's own Checkout button arrived with no
 * parameters, matched nothing and rendered "Nothing to check out" — the whole
 * cart path terminated in a dead end.
 */
export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const params = await searchParams;
  const slug =
    (typeof params.course === "string" && params.course) ||
    (typeof params.membership === "string" && params.membership) ||
    (typeof params.series === "string" && params.series) ||
    (typeof params.retreat === "string" && params.retreat) ||
    null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /*
    The period the customer chose on the storefront travels in the URL and is
    honoured here, so the figure they were shown is the figure they are charged.
    An absent or malformed value falls back to monthly — the smaller commitment
    — rather than silently billing the larger one.
  */
  const billing = isBillingPeriod(params.billing) ? params.billing : "monthly";

  const stored = slug ? [] : await readCart();
  const lines = slug
    ? await priceCart([{ productSlug: slug, quantity: 1, billing }])
    : await priceCart(
        stored.map((l) => ({
          productSlug: l.slug,
          quantity: l.qty,
          billing: l.billing,
        })),
      );

  if (lines.length === 0) {
    return (
      <EmptyState
        title={slug ? "Nothing to check out" : "Your cart is empty"}
        description={
          slug
            ? "That item isn't available for purchase right now."
            : "Add something to your cart, or buy directly from any coaching page."
        }
        action={<ButtonLink href="/coaching">Browse coaching</ButtonLink>}
      />
    );
  }

  const total = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
  const currency = lines[0]?.currency;

  // Stripe refuses a session mixing a subscription with a one-off, and the
  // action rejects it too. Saying so HERE means the customer finds out before
  // filling in their email rather than after pressing pay.
  const hasRecurring = lines.some((l) => l.billingType === "recurring");
  const hasOneOff = lines.some((l) => l.billingType !== "recurring");
  const mixed = hasRecurring && hasOneOff;

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr]">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Checkout
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;ll be taken to Stripe to pay. Card details never reach this
          site.
        </p>

        {mixed ? (
          <div
            role="alert"
            className="mt-6 rounded-(--radius) border border-warning bg-warning/10 p-4 text-sm"
          >
            <p className="font-semibold">These need two separate payments</p>
            <p className="mt-1 text-muted-foreground">
              A membership is a subscription and has to be bought on its own.
              Please check it out separately from the one-off items — your cart
              keeps everything else.
            </p>
            <p className="mt-3">
              <Link href="/cart" className="font-medium text-primary underline underline-offset-4">
                Back to cart
              </Link>
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <CheckoutForm
              product={slug ?? undefined}
              billing={slug ? billing : undefined}
              signedInEmail={user?.email ?? null}
            />
          </div>
        )}
      </div>

      <aside className="h-fit rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-semibold">Order summary</h2>

        <ul className="mt-4 space-y-3">
          {lines.map((line) => (
            <li key={line.productId} className="flex justify-between gap-4 text-sm">
              <span>
                {line.name}
                {line.quantity > 1 ? (
                  <span className="text-muted-foreground"> × {line.quantity}</span>
                ) : null}
                {/* State the commitment, not just the amount (note 07 §37.1). */}
                <span className="block text-xs text-muted-foreground">
                  {line.billingType === "recurring"
                    ? `Renews every ${line.interval ?? "month"}`
                    : "One payment"}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatPrice(line.unitAmount * line.quantity, line.currency)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
          <span className="font-medium">
            {hasRecurring && !hasOneOff ? "Due today" : "Total"}
          </span>
          <span className="font-display text-2xl font-semibold tabular-nums">
            {formatPrice(total, currency)}
          </span>
        </div>

        {!slug ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link href="/cart" className="underline underline-offset-4 hover:text-foreground">
              Edit your cart
            </Link>
          </p>
        ) : null}
      </aside>
    </div>
  );
}
