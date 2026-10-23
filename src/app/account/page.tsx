import type { Metadata } from "next";
import Link from "next/link";

import { AccessRow } from "@/components/account/AccessRow";
import { AccountHeader, AccountSection } from "@/components/account/AccountHeader";
import { UnclaimedOrders } from "@/components/account/UnclaimedOrders";
import { ORDER_STATUS, StatusPill, statusOf } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Icon";
import { myMembership } from "@/lib/academy/membership";
import { myOrders, myProfile, orderTitle } from "@/lib/account";
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
  const [profile, access, bookings, membership, orders] = await Promise.all([
    myProfile(),
    myAccess(),
    myBookingsByTime(),
    myMembership(),
    myOrders(),
  ]);

  const firstName = profile?.first_name?.trim() || profile?.display_name?.trim().split(" ")[0];
  const live = access.filter((a) => a.state === "active");
  const next = bookings.upcoming[0] ?? null;
  const canBook = live.some((a) => a.href === "/book");
  // The entitlement, not the subscription (note 09 §16.1): a member who paid
  // once for a year has no subscription, and is a member all the same.
  const recentOrders = orders.slice(0, 3);

  return (
    <>
      <AccountHeader
        title={firstName ? `Hello, ${firstName}` : "Your account"}
        description="What's coming up, what you can use, and what you've paid, all in one place."
      />

      <UnclaimedOrders />

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
                You have sessions paid for and still to schedule. Pick a time that suits you.
              </p>
            </div>
            <ButtonLink href="/book" size="sm">
              Book a session
            </ButtonLink>
          </section>
        ) : null}

        {/* 2 — The Coaching Pass, on a line of its own and ahead of the access
            list (owner, 2026-10-09). */}
        <AccountSection
          title="Coaching Pass"
          action={
            <Link href="/account/pass" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              Details
            </Link>
          }
        >
          <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
            {membership ? (
              <>
                {/* Across the page now: what it is and when it ends on the
                    left, its state and the way in on the right. */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
                  <div className="flex min-w-0 items-center gap-4">
                    <IconTile name="star" tone="accent" />
                    <div className="min-w-0">
                      <p className="font-display text-2xl leading-tight font-semibold">{membership.tierName}</p>
                      {membership.date ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {membership.renews ? "Renews" : "Ends"} on{" "}
                          <span className="font-medium text-foreground">{formatDate(membership.date)}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 pl-14 sm:pl-0">
                    <StatusPill tone={membership.pastDue ? "warn" : "good"}>
                      {membership.pastDue ? "Payment due" : "Active"}
                    </StatusPill>
                    <ButtonLink href="/academy/pass" size="sm">
                      Open your pass
                    </ButtonLink>
                  </div>
                </div>
                {membership.pastDue ? (
                  <p className="mt-4 rounded-(--radius) border border-warning/40 bg-warning/10 p-3 text-sm sm:ml-14">
                    A payment failed. Your pass continues for now. Update your card under
                    Billing to keep it.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="font-medium">You don&apos;t have a Coaching Pass yet</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Live Group Coaching, the video playlists and a monthly Q&amp;A with Tony.
                </p>
                <div className="mt-4">
                  <ButtonLink href="/coaching/passes" size="sm" variant="outline">
                    Compare tiers
                  </ButtonLink>
                </div>
              </>
            )}
          </div>
        </AccountSection>

        {/* 3 — What you can use. */}
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
            <ul className="space-y-6 sm:space-y-8">
              {live.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <AccessRow item={item} />
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

        {/* 4 — Recent orders, on a line of their own (owner, 2026-10-09: the
            pass and the orders are not set side by side). */}
        <AccountSection
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
            <div className="rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6">
              <p className="font-medium">No orders yet</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Receipts for everything you buy are kept here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card">
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
