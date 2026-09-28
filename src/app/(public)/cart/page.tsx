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
    stored.map((l) => ({
      productSlug: l.slug,
      quantity: l.qty,
      billing: l.billing,
    })),
  );
  const total = cartTotal(lines);
  const currency = lines[0]?.currency;

  // Stripe cannot put a subscription and a one-off in one session, so the cart
  // says so HERE rather than letting the customer discover it at the payment
  // step (note 09 §13).
  const hasRecurring = lines.some((l) => l.billingType === "recurring");
  const hasOneOff = lines.some((l) => l.billingType !== "recurring");
  const mixed = hasRecurring && hasOneOff;

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Checkout"
          title="Your cart"
          description={
            lines.length > 0
              ? `${itemCount} ${itemCount === 1 ? "item" : "items"}, priced and ready when you are.`
              : undefined
          }
        />

        {lines.length === 0 ? (
          <EmptyCart />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start lg:gap-12">
            <div>
              <ul className="divide-y divide-border rounded-(--radius-lg) border border-border bg-surface shadow-card">
                {lines.map((line) => {
                  const recurring = line.billingType === "recurring";
                  return (
                    <li key={line.productId} className="p-5 sm:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                            {typeLabel(line.productType)}
                          </p>
                          <p className="mt-1.5 font-display text-xl leading-snug font-semibold text-balance">
                            {line.name}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {recurring
                              ? `${formatPrice(line.unitAmount, line.currency)} every ${line.interval ?? "month"}, cancel any time`
                              : line.quantity > 1
                                ? `${formatPrice(line.unitAmount, line.currency)} each, one payment`
                                : "One payment"}
                          </p>
                        </div>

                        <p className="shrink-0 font-display text-xl font-semibold tabular-nums">
                          {formatPrice(
                            line.unitAmount * line.quantity,
                            line.currency,
                          )}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-4">
                        {recurring ? (
                          <span />
                        ) : (
                          <QuantityStepper
                            slug={line.slug}
                            quantity={line.quantity}
                            name={line.name}
                          />
                        )}

                        <form action={removeFromCartAction}>
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
                  );
                })}
              </ul>

              <div className="mt-5 flex items-center justify-between gap-4 px-1">
                <Link
                  href="/coaching"
                  className="text-sm font-medium underline-offset-4 hover:text-accent hover:underline"
                >
                  &larr; Continue shopping
                </Link>
                <form action={clearCartAction}>
                  <button
                    type="submit"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-error hover:underline"
                  >
                    Empty cart
                  </button>
                </form>
              </div>
            </div>

            <aside className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card sm:p-7 lg:sticky lg:top-24">
              <h3 className="font-display text-xl font-semibold">
                Order summary
              </h3>

              <dl className="mt-5 space-y-2.5 text-sm">
                {lines.map((line) => (
                  <div
                    key={line.productId}
                    className="flex justify-between gap-4"
                  >
                    <dt className="min-w-0 text-muted-foreground">
                      {line.name}
                      {line.quantity > 1 ? (
                        <span className="whitespace-nowrap">
                          {` × ${line.quantity}`}
                        </span>
                      ) : null}
                    </dt>
                    <dd className="shrink-0 tabular-nums">
                      {formatPrice(
                        line.unitAmount * line.quantity,
                        line.currency,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
                <span className="font-semibold">Total</span>
                <span className="font-display text-3xl font-semibold tabular-nums">
                  {formatPrice(total, currency)}
                </span>
              </div>

              {mixed ? (
                <p
                  role="alert"
                  className="mt-5 rounded-(--radius) border border-warning bg-warning/10 p-3 text-sm"
                >
                  A membership is a subscription, so it has to be paid for on
                  its own. Please check it out separately from the one-off
                  items.
                </p>
              ) : null}

              <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
                Checkout
              </ButtonLink>

              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LockIcon />
                Secure payment by Stripe
              </p>

              <p className="mt-5 border-t border-border pt-5 text-center text-sm text-muted-foreground">
                No account needed to buy.{" "}
                <Link
                  href="/auth/sign-in?next=/cart"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-accent"
                >
                  Sign in
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

const TYPE_LABELS: Record<string, string> = {
  membership: "Membership",
  course: "Course",
  bundle: "Bundle",
  cohort: "Cohort",
  group_coaching: "Group coaching",
  private_coaching: "Private coaching",
};

function typeLabel(type: string) {
  return TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

/**
 * − qty + in one form: each button submits its own `qty`, so a change is one
 * click with no separate "Update" step and no client JavaScript. Going below 1
 * removes the line, as `updateQuantityAction` already does for 0.
 */
function QuantityStepper({
  slug,
  quantity,
  name,
}: {
  slug: string;
  quantity: number;
  name: string;
}) {
  const step =
    "flex size-9 items-center justify-center text-lg text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <form
      action={updateQuantityAction}
      className="inline-flex items-center overflow-hidden rounded-full border border-input-border"
    >
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        name="qty"
        value={quantity - 1}
        className={step}
        aria-label={quantity === 1 ? `Remove ${name}` : `One fewer ${name}`}
      >
        &minus;
      </button>
      <span
        className="w-8 text-center text-sm font-semibold tabular-nums"
        aria-label="Quantity"
      >
        {quantity}
      </span>
      <button
        type="submit"
        name="qty"
        value={quantity + 1}
        disabled={quantity >= 10}
        className={step}
        aria-label={`One more ${name}`}
      >
        +
      </button>
    </form>
  );
}

/** The empty cart points straight at the three ways in, not one vague link. */
function EmptyCart() {
  const routes = [
    {
      label: "Memberships",
      note: "Monthly or yearly, four tiers",
      href: "/coaching/memberships",
    },
    {
      label: "Courses",
      note: "Self-paced, yours to keep",
      href: "/coaching/courses",
    },
    {
      label: "Private coaching",
      note: "One-to-one with Tony",
      href: "/coaching/private-coaching",
    },
  ];
  return (
    <div className="rounded-(--radius-lg) border border-border bg-surface px-6 py-12 text-center shadow-card sm:px-10 sm:py-14">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-surface-muted text-primary">
        <BagIcon />
      </span>
      <h3 className="mt-5 font-display text-2xl font-semibold">
        Your cart is empty
      </h3>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Pick a way to work with Tony and it will wait here for you.
      </p>

      <ul className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
        {routes.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="group flex h-full flex-col rounded-(--radius) border border-border bg-background p-4 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-card"
            >
              <span className="flex items-center justify-between font-semibold">
                {r.label}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                >
                  &rarr;
                </span>
              </span>
              <span className="mt-1 text-sm text-muted-foreground">
                {r.note}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        <ButtonLink href="/coaching">Browse coaching</ButtonLink>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}
