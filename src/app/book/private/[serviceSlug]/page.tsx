import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SlotPicker, type SlotDay, type SlotWeek } from "@/app/book/private/SlotPicker";
import { AccountHeader } from "@/components/account/AccountHeader";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { openSlots, privateCredits } from "@/lib/bookings/private";
import { optionsForProducts } from "@/lib/commerce/options";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCoachingService } from "@/lib/content/coaching";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Choose a time", robots: { index: false } };

const UK = "Europe/London";

/**
 * Private coaching: choose a time — note 09 §36.
 *
 *   holding a session   (a pack, a gift, or one returned by a cancellation)
 *                       the time is booked with it here (migration 0020).
 *   holding none        ONE SESSION IS CHOSEN, THEN PAID FOR (owner, 2026-11-10;
 *                       migration 0030): the chosen time goes on to checkout and
 *                       is held while they pay. A pack is still bought first.
 *
 * Reached from the service page.
 *
 * Sits under /book, the task-focused booking area (note 03 §29), beside
 * group sessions at /book/[bookableId]; the static `private` segment
 * keeps the two apart.
 */
export default async function PrivateCoachingBookingPage({
  params,
}: PageProps<"/book/private/[serviceSlug]">) {
  const { serviceSlug } = await params;
  await requireUser(`/book/private/${serviceSlug}`);

  const service = await getCoachingService(serviceSlug);
  if (!service) notFound();

  const [slots, credits, alternatives] = await Promise.all([
    openSlots(service.id),
    privateCredits(service.id),
    service.productSlug ? optionsForProducts([service.productSlug]) : Promise.resolve(new Map()),
  ]);

  // What can be bought, for somebody with no session to use yet: the single
  // session and any pack (products sharing its option group).
  const buyable = (service.productSlug
    ? ((alternatives.get(service.productSlug) ?? []) as Array<{ slug: string; label: string; credits: number | null; amount: number; currency: string }>)
    : []);

  const price = service.prices[0] ?? null;
  const shown = price ? formatPrice(price.amount, price.currency) : null;
  // The single session is bought for the time chosen here; a pack is bought
  // first and booked from here afterwards.
  const singleSlug = buyable.find((o) => (o.credits ?? 1) === 1)?.slug ?? service.productSlug;
  const pack = buyable.find((o) => (o.credits ?? 1) > 1) ?? null;

  // Grouped by UK calendar day, and the days BY MONTH: "October", "November"
  // (owner, 2026-10-09: not "Week of 12 October"). Formatted here so the client
  // never reads a clock.
  const part = (date: Date, options: Intl.DateTimeFormatOptions) => date.toLocaleDateString("en-GB", { ...options, timeZone: UK });

  const days: SlotDay[] = [];
  const weeks: SlotWeek[] = [];
  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const label = part(start, { weekday: "long", day: "numeric", month: "long" });
    const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: UK });
    const last = days.at(-1);
    if (last?.label === label) {
      last.slots.push({ id: slot.id, time });
      continue;
    }
    const day: SlotDay = {
      label,
      weekday: part(start, { weekday: "short" }),
      dayOfMonth: part(start, { day: "numeric" }),
      slots: [{ id: slot.id, time }],
    };
    days.push(day);

    const weekLabel = part(start, { month: "long", year: "numeric" });
    const week = weeks.at(-1);
    if (week?.label === weekLabel) week.days.push(day);
    else weeks.push({ label: weekLabel, days: [day] });
  }

  return (
    <>
      {/* Back to where they most likely came from: somebody holding a session
          to book arrives from /book (or their account); anyone else from
          the service's page. */}
      {credits > 0 ? (
        <BackLink href="/book">Book a session</BackLink>
      ) : (
        <BackLink href={`/coaching/private-coaching/${service.slug}`}>{service.name}</BackLink>
      )}

      <AccountHeader
        title="Choose a time"
        description={`${service.name} · ${service.duration_minutes} minutes with Tony, one to one. Times are UK time.`}
      />

      {credits > 0 ? (
        <p className="mb-8 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
          You have <span className="font-medium">{credits}</span> session{credits === 1 ? "" : "s"} to book.
        </p>
      ) : days.length === 0 ? null : (
        // No session to use: pick a time, then pay for it (migration 0030).
        // No time open means nothing on sale (0029), so this waits for one.
        <div className="mb-8 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
          <p className="font-medium">Pick a time, then pay{shown ? ` ${shown}` : ""}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your time is held for you while you pay, and booked as soon as payment goes through.
          </p>
          {pack ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Booking several?{" "}
              <Link href={`/checkout?product=${pack.slug}`} className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                Buy {pack.label} for {formatPrice(pack.amount, pack.currency)}
              </Link>{" "}
              and book each session here when you like.
            </p>
          ) : null}
        </div>
      )}

      {days.length === 0 ? (
        <EmptyState icon="clock"
          title="Dates to be advised"
          description={credits > 0
            ? "No times are open just now. New times are added regularly, and your sessions wait in your Academy until you book them."
            : "No times are open just now, so sessions are not on sale. They go on sale as soon as Tony opens times in his diary."}
          action={<ButtonLink href="/contact">Get in touch</ButtonLink>}
        />
      ) : credits > 0 ? (
        <>
          <SlotPicker weeks={weeks} submitLabel="Book this time" />
          <p className="mt-6 text-sm text-muted-foreground">
            Booking uses one of your sessions. Cancel at least 48 hours ahead and the session is returned to your
            account to rebook.
          </p>
        </>
      ) : singleSlug ? (
        <>
          <SlotPicker weeks={weeks} submitLabel="Continue to payment" pay={{ product: singleSlug }} />
          <p className="mt-6 text-sm text-muted-foreground">
            Cancel at least 48 hours ahead and the session is returned to your account to rebook.
          </p>
        </>
      ) : (
        <EmptyState icon="clock"
          title="Not available to book online"
          description="Get in touch and we'll find a time that suits you."
          action={<ButtonLink href="/contact">Get in touch</ButtonLink>}
        />
      )}
    </>
  );
}
