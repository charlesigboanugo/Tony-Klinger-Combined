import type { Metadata } from "next";
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
 * Private coaching: choose a time with a session already paid for — note 09
 * §36, migration 0020 (pay first, then book since 2026-10-08). Reached from
 * the service page.
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
        title={credits > 0 ? "Choose a time" : "Available times"}
        description={`${service.name} · ${service.duration_minutes} minutes with Tony, one to one. Times are UK time.`}
      />

      {/*
        PAY FIRST, THEN BOOK (owner, 2026-10-08). With a session to use, the
        times can be chosen. Without one they are shown so the customer can see
        what is open before paying, and the buttons below are how to buy.
      */}
      {credits > 0 ? (
        <p className="mb-8 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
          You have <span className="font-medium">{credits}</span> session{credits === 1 ? "" : "s"} to book.
        </p>
      ) : (
        <div className="mb-8 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card">
          <p className="font-medium">Buy a session first, then choose your time</p>
          <p className="mt-1 text-sm text-muted-foreground">
            These are the times open now. Once you have paid, come back here and pick the one you want.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {buyable.length > 0 ? (
              buyable.map((o, i) => (
                <ButtonLink key={o.slug} href={`/checkout?product=${o.slug}`} size="sm" variant={i === 0 ? "primary" : "outline"}>
                  Buy {o.label} · {formatPrice(o.amount, o.currency)}
                </ButtonLink>
              ))
            ) : service.productSlug ? (
              <ButtonLink href={`/checkout?product=${service.productSlug}`} size="sm">
                Buy a session{shown ? ` · ${shown}` : ""}
              </ButtonLink>
            ) : (
              <ButtonLink href="/contact" size="sm">Get in touch</ButtonLink>
            )}
          </div>
        </div>
      )}

      {days.length === 0 ? (
        <EmptyState icon="clock"
          title="No times open just now"
          description="New times are added regularly. Get in touch and we'll find one that suits you."
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
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
          {days.map((day) => (
            <li key={day.label} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-6">
              <span className="font-medium sm:w-56 sm:shrink-0">{day.label}</span>
              <span className="text-sm text-muted-foreground">{day.slots.map((slot) => slot.time).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
