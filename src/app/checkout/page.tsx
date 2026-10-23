import type { Metadata } from "next";
import Link from "next/link";

import { CheckoutForm } from "@/app/checkout/CheckoutForm";
import { OptionSwitch } from "@/components/coaching/OptionSwitch";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isBillingPeriod } from "@/lib/commerce/billing";
import { readCart } from "@/lib/commerce/cart";
import { optionsForProducts } from "@/lib/commerce/options";
import { priceCart } from "@/lib/commerce/orders";
import { formatPrice } from "@/lib/commerce/pricing";
import { giftBlock } from "@/lib/commerce/gift";
import { applyPassUpgrades } from "@/lib/commerce/pass-upgrade";
import { saleCheck } from "@/lib/commerce/sale-check";
import { createPublicClient } from "@/lib/supabase/public";
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
 *   buy-now   /checkout?product=…     a single product from a detail page
 *   cart      /checkout               everything in the cart
 *
 * `?product=` names any product. The older, kind-specific names (`membership`,
 * `course`, `series`, `retreat`, `event`, `cohort`) mean exactly the same and
 * are still read, because pages and emails already link with them.
 *
 * A buy-now checkout still lets the customer change their mind: where the
 * product is one option of several (one session or eight, a retreat's levels)
 * or is sold monthly and for a year, the summary carries the switch, and each
 * choice is a link back to this page with the other product or period.
 *
 * The cart route did not previously exist. `/checkout` read only a single slug
 * from the query string, so the cart's own Checkout button arrived with no
 * parameters, matched nothing and rendered "Nothing to check out" — the whole
 * cart path terminated in a dead end.
 */
/** "Friday 23 October, 5:00 pm", in the site's time zone. */
function sessionDay(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Europe/London",
  });
}

export default async function CheckoutPage({ searchParams }: PageProps<"/checkout">) {
  const params = await searchParams;
  const slug =
    (typeof params.product === "string" && params.product) ||
    (typeof params.course === "string" && params.course) ||
    (typeof params.membership === "string" && params.membership) ||
    (typeof params.series === "string" && params.series) ||
    (typeof params.cohort === "string" && params.cohort) ||
    (typeof params.retreat === "string" && params.retreat) ||
    (typeof params.event === "string" && params.event) ||
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

  // One Group Coaching session is bought for a date, named in the URL by the
  // series page (migration 0022) and checked against the database below.
  const sessionId = typeof params.session === "string" ? params.session : undefined;

  // Bought for someone else (lib/commerce/gift): priced and checked as for a
  // signed-out visitor, so the buyer's own pass or purchases change nothing.
  const gift = params.gift === "1";
  const asker = gift ? createPublicClient() : supabase;

  const stored = slug ? [] : await readCart();
  const priced = slug
    ? await priceCart([{ productSlug: slug, quantity: 1, billing, sessionId }])
    : await priceCart(
        stored.map((l) => ({
          productSlug: l.slug,
          quantity: l.qty,
          billing: l.billing,
        })),
      );
  // A higher pass, for somebody holding a lower one, is an upgrade at the
  // difference in price (migration 0027); the action prices it the same way.
  const lines = await applyPassUpgrades(asker, priced);

  if (lines.length === 0) {
    return (
      <EmptyState icon="bag"
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

  // This same checkout, to come back to after signing in: the buy-now choice
  // travels in the URL, and a cart checkout re-reads the cart.
  const query = (asGift: boolean) =>
    new URLSearchParams({
      ...(slug ? { product: slug, billing } : {}),
      ...(slug && sessionId ? { session: sessionId } : {}),
      ...(asGift ? { gift: "1" } : {}),
    }).toString();
  const at = (asGift: boolean) => (query(asGift) ? `/checkout?${query(asGift)}` : "/checkout");
  const returnTo = at(false);
  // Why this can't be a gift, if it can't; the gift link is offered only when it can.
  const notGiftable = giftBlock(lines);

  const total = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
  const currency = lines[0]?.currency;

  // Anything that cannot be sold to this person now — already theirs, sessions
  // still to use, full, no date. Said HERE, in place of the form, so nobody
  // fills it in to be refused; the action asks the same question again.
  const blocks = (
    await Promise.all(
      lines.map((line) => saleCheck(asker, line)),
    )
  ).filter((b) => b !== null);

  // Buy-now only: the cart has its own switches, on the cart page. Not for
  // Group Coaching: one of its two options needs a date chosen on the series
  // page, so the switch here would lead to a line that cannot be sold.
  const single = slug ? lines[0] : null;
  const alternatives =
    slug && single?.productType !== "group_coaching" ? ((await optionsForProducts([slug])).get(slug) ?? []) : [];

  // The date a single session is for, to show on its line.
  const dated = lines.find((l) => l.needsDate && l.sessionId);
  const chosen = dated
    ? (((await supabase.rpc("coming_sessions", { p_series_id: dated.seriesId ?? "" })).data ?? []) as Array<{
        id: string;
        title: string | null;
        starts_at: string;
      }>).find((s) => s.id === dated.sessionId) ?? null
    : null;

  // Stripe refuses a session mixing a subscription with a one-off, and the
  // action rejects it too. Saying so HERE means the customer finds out before
  // filling in their email rather than after pressing pay.
  const hasRecurring = lines.some((l) => l.billingType === "recurring");
  const hasOneOff = lines.some((l) => l.billingType !== "recurring");
  const mixed = hasRecurring && hasOneOff;

  return (
    <>
      {/* No back button here (owner, 2026-10-08). The checkout header already
          has "Back to site", and a cart checkout has "Edit your cart" in its
          summary; a third way out above the heading only competes with paying. */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <h1 className="font-display">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;ll be taken to Stripe to pay. Card details never reach this
            site.
          </p>

          {gift && notGiftable ? (
            <div role="alert" className="mt-6 rounded-(--radius) border border-warning bg-warning/10 p-4 text-sm">
              <p className="font-semibold">This can&apos;t be bought as a gift</p>
              <p className="mt-1 text-muted-foreground">{notGiftable}</p>
              <p className="mt-3">
                <Link href={at(false)} className="font-medium text-primary underline underline-offset-4">
                  Buy it for yourself instead
                </Link>
              </p>
            </div>
          ) : blocks.length > 0 ? (
            <div role="alert" className="mt-6 rounded-(--radius) border border-warning bg-warning/10 p-4 text-sm">
              <p className="font-semibold">{slug ? "This can't be bought right now" : "Something in your cart can't be bought right now"}</p>
              <ul className="mt-2 space-y-2 text-muted-foreground">
                {blocks.map((b) => (
                  <li key={b.message}>
                    {b.message}{" "}
                    {b.href && b.action ? (
                      <Link href={b.href} className="font-medium text-primary underline underline-offset-4">
                        {b.action}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!slug ? (
                <p className="mt-3">
                  <Link href="/cart" className="font-medium text-primary underline underline-offset-4">
                    Back to cart
                  </Link>
                </p>
              ) : null}
            </div>
          ) : mixed ? (
            <div
              role="alert"
              className="mt-6 rounded-(--radius) border border-warning bg-warning/10 p-4 text-sm"
            >
              <p className="font-semibold">These need two separate payments</p>
              <p className="mt-1 text-muted-foreground">
                A renewing subscription has to be bought on its own.
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
                session={dated?.sessionId ?? undefined}
                signedInEmail={user?.email ?? null}
                returnTo={returnTo}
                gift={gift}
                giftHref={notGiftable ? null : at(true)}
                selfHref={at(false)}
              />
            </div>
          )}
        </div>

        <aside className="h-fit rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
          <h3 className="font-display text-lg font-semibold">Order summary</h3>

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
                      : line.upgradeFrom
                        ? `You pay the difference${line.fullAmount ? ` (${formatPrice(line.fullAmount, line.currency)} less what your pass cost)` : ""}. Your pass moves up for the rest of its year; its end date does not change`
                        : line.productType === "membership"
                          ? "One payment for twelve months. It does not renew"
                          : line.needsDate && chosen
                            ? `${sessionDay(chosen.starts_at)}. Your seat is kept as you pay`
                            : "One payment"}
                  </span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatPrice(line.unitAmount * line.quantity, line.currency)}
                </span>
              </li>
            ))}
          </ul>

          {alternatives.length > 1 ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Change your choice</p>
              <OptionSwitch
                label="Choose an option"
                size="sm"
                stretch
                options={alternatives.map((o) => ({
                  value: o.slug,
                  label: o.label,
                  note: formatPrice(o.amount, o.currency),
                  active: o.slug === slug,
                  href: `/checkout?product=${o.slug}${gift ? "&gift=1" : ""}`,
                }))}
              />
            </div>
          ) : null}

          {single?.billing && single.otherPeriod ? (
            <div className="mt-5">
              <p className="mb-2 text-xs font-medium text-muted-foreground">How you pay</p>
              <OptionSwitch
                label="How to pay"
                size="sm"
                stretch
                options={(["monthly", "yearly"] as const).map((period) => {
                  const amount = period === single.billing ? single.unitAmount : single.otherPeriod!.amount;
                  return {
                    value: period,
                    label: period === "monthly" ? "Monthly" : "Yearly",
                    note: `${formatPrice(amount, single.currency)}${period === "monthly" ? " a month" : " a year"}`,
                    active: period === single.billing,
                    href: `/checkout?product=${slug}&billing=${period}${gift ? "&gift=1" : ""}`,
                  };
                })}
              />
            </div>
          ) : null}

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
    </>
  );
}
