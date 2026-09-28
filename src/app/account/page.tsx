import type { Metadata } from "next";
import Link from "next/link";

import { AccessCard } from "@/components/account/AccessCard";
import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { ORDER_STATUS, SUBSCRIPTION_STATUS, StatusPill, statusOf } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Icon";
import { myOrders, myProfile, mySubscriptions, orderTitle } from "@/lib/account";
import { myAccess } from "@/lib/account/access";
import { dateBadge, formatDate, formatDateTime } from "@/lib/account/format";
import { myBookingsByTime } from "@/lib/bookings";
import { formatPrice } from "@/lib/commerce/pricing";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

/**
 * Account overview — note 03 §24, note 01 §28.
 *
 * Answers, in order, what someone opens their account to find out:
 *
 *   1. What is coming up?        the next booking, with its ticket
 *   2. What can I use?           live access, each with the action that uses it
 *   3. Am I a member? What did I pay?   membership and the latest orders
 *
 * No count tiles ("Orders: 4"). A number says nothing a customer can act on,
 * and the owner has rejected decorative counts site-wide; each section shows
 * the things themselves, with a link to the full list.
 */
export default async function AccountPage() {
  const context = await requireUser("/account");
  const [profile, access, bookings, subscriptions, orders] = await Promise.all([
    myProfile(),
    myAccess(),
    myBookingsByTime(),
    mySubscriptions(),
    myOrders(),
  ]);

  const firstName = profile?.first_name?.trim() || profile?.display_name?.trim().split(" ")[0];
  const live = access.filter((a) => a.state === "active");
  const next = bookings.upcoming[0] ?? null;
  const canBook = live.some((a) => a.href === "/bookings");
  const membership =
    subscriptions.find((s) => ["active", "trialing", "past_due"].includes(s.status)) ?? null;
  const recentOrders = orders.slice(0, 3);

  return (
    <>
      <AccountHeader
        title={firstName ? `Hello, ${firstName}` : "Your account"}
        description="What's coming up, what you can use, and what you've paid, all in one place."
      />

      <div className="space-y-14 sm:space-y-16">
        {/* 1 — Up next. Noir: the site's one colour field (note 10 §5). */}
        {next?.starts_at ? (
          <section aria-labelledby="up-next">
            <div className="relative overflow-hidden rounded-(--radius-lg) bg-block-noir p-5 text-block-foreground shadow-lift sm:p-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div
                  aria-hidden="true"
                  className="grid h-18 w-18 shrink-0 place-items-center rounded-(--radius) bg-button text-button-foreground"
                >
                  <span className="text-center leading-none">
                    <span className="block font-display text-3xl font-semibold">
                      {dateBadge(next.starts_at).day}
                    </span>
                    <span className="mt-1 block text-xs font-semibold tracking-widest uppercase">
                      {dateBadge(next.starts_at).month}
                    </span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="up-next"
                    className="font-sans text-xs font-semibold tracking-[0.18em] text-block-foreground/70 uppercase"
                  >
                    Up next
                  </h2>
                  <p className="mt-1.5 font-display text-2xl leading-tight font-semibold text-balance">
                    {next.title ?? next.bookable_type.replace(/_/g, " ")}
                  </p>
                  <p className="mt-1 text-sm text-block-foreground/80">
                    {formatDateTime(next.starts_at)}
                    {next.seriesName && next.seriesName !== "Event" ? ` · ${next.seriesName}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {next.bookable_type === "event" ? (
                    <ButtonLink href={`/account/tickets/${next.id}`} variant="onBlock" size="sm">
                      View ticket
                    </ButtonLink>
                  ) : null}
                  <ButtonLink href="/account/bookings" variant="onBlockOutline" size="sm">
                    {bookings.upcoming.length > 1 ? "All bookings" : "Manage booking"}
                  </ButtonLink>
                </div>
              </div>
            </div>
          </section>
        ) : canBook ? (
          <section
            aria-labelledby="up-next"
            className="flex flex-col gap-4 rounded-(--radius-lg) border border-dashed border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
          >
            <div>
              <h2 id="up-next" className="font-sans text-base font-semibold">
                Nothing booked yet
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your Group Coaching access lets you book sessions. Pick one that suits you.
              </p>
            </div>
            <ButtonLink href="/bookings" size="sm">
              Book a session
            </ButtonLink>
          </section>
        ) : null}

        {/* 2 — What you can use. */}
        <AccountSection
          title="Your access"
          action={
            access.length > 0 ? (
              <Link
                href="/account/entitlements"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                See all
              </Link>
            ) : null
          }
        >
          {live.length === 0 ? (
            <div className="rounded-(--radius-lg) border border-border bg-surface p-6 text-center sm:p-8">
              <p className="font-medium">Nothing to open yet</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                Courses, cohorts, Group Coaching and event tickets you buy appear here, ready to
                use.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/coaching" size="sm">
                  Explore coaching
                </ButtonLink>
                <ButtonLink href="/events" size="sm" variant="outline">
                  See events
                </ButtonLink>
              </div>
            </div>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2">
              {live.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <AccessCard item={item} />
                </li>
              ))}
            </ul>
          )}
          {live.length > 4 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              And {live.length - 4} more on{" "}
              <Link href="/account/entitlements" className="font-medium text-primary underline-offset-4 hover:underline">
                Your access
              </Link>
              .
            </p>
          ) : null}
        </AccountSection>

        {/* 3 — Membership and money, side by side from md. */}
        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          {/* Both columns stretch to the taller card, so the pair ends on one
              line whatever each holds (owner, 2026-09-27). */}
          <AccountSection
            className="flex flex-col"
            title="Membership"
            action={
              <Link href="/account/memberships" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                Details
              </Link>
            }
          >
            <div className="flex-1 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
              {membership ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <IconTile name="star" tone="accent" />
                      <p className="font-display text-2xl font-semibold capitalize">
                        {membership.membership_tier ?? "Member"}
                      </p>
                    </div>
                    <StatusPill tone={statusOf(SUBSCRIPTION_STATUS, membership.status).tone}>
                      {statusOf(SUBSCRIPTION_STATUS, membership.status).label}
                    </StatusPill>
                  </div>
                  {membership.current_period_end ? (
                    <p className="mt-2 pl-13 text-sm text-muted-foreground">
                      {membership.cancel_at ? "Ends" : "Renews"} on{" "}
                      <span className="font-medium text-foreground">
                        {formatDate(membership.current_period_end)}
                      </span>
                    </p>
                  ) : null}
                  {membership.status === "past_due" ? (
                    <p className="mt-3 ml-13 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm">
                      A payment failed. Your membership continues for now. Contact us to update
                      your card.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="font-medium">You&apos;re not a member yet</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Each tier includes everything in the tiers below it.
                  </p>
                  <div className="mt-4">
                    <ButtonLink href="/coaching/memberships" size="sm" variant="outline">
                      Compare tiers
                    </ButtonLink>
                  </div>
                </>
              )}
            </div>
          </AccountSection>

          <AccountSection
            className="flex flex-col"
            title="Recent orders"
            action={
              orders.length > 0 ? (
                <Link href="/account/orders" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  All orders
                </Link>
              ) : null
            }
          >
            {recentOrders.length === 0 ? (
              <div className="flex-1 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
                <p className="font-medium">No orders yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Receipts for everything you buy are kept here.
                </p>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card">
                {recentOrders.map((order) => {
                  const status = statusOf(ORDER_STATUS, order.status);
                  return (
                    <li key={order.id}>
                      <Link
                        href={`/account/orders/${order.id}`}
                        className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-muted"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{orderTitle(order)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPrice(order.total, order.currency)}
                          </span>
                          {order.status !== "paid" ? (
                            <StatusPill tone={status.tone}>{status.label}</StatusPill>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </AccountSection>
        </div>

        {context.isStaff ? (
          <p className="flex items-center gap-3 rounded-(--radius-lg) border border-border bg-surface p-5 text-sm">
            <span>
            This account holds a staff role.{" "}
            <Link href="/admin" className="font-medium text-primary underline-offset-4 hover:underline">
              Go to the admin workspace
            </Link>
            .
            </span>
          </p>
        ) : null}
      </div>
    </>
  );
}
