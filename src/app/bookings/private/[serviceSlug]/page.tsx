import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SlotPicker, type SlotDay } from "@/app/bookings/private/SlotPicker";
import { AccountHeader } from "@/components/account/AccountHeader";
import { BackLink } from "@/components/ui/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { openSlots, privateCredits } from "@/lib/bookings/private";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCoachingService } from "@/lib/content/coaching";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Choose a time", robots: { index: false } };

const UK = "Europe/London";

/**
 * Private coaching: choose a time, then pay — note 09 §35 (book-first),
 * migration 0020. Reached from the service page's "Check availability".
 *
 * Sits under /bookings, the task-focused booking area (note 03 §29), beside
 * group sessions at /bookings/[bookableId]; the static `private` segment
 * keeps the two apart.
 */
export default async function PrivateCoachingBookingPage({
  params,
}: PageProps<"/bookings/private/[serviceSlug]">) {
  const { serviceSlug } = await params;
  await requireUser(`/bookings/private/${serviceSlug}`);

  const service = await getCoachingService(serviceSlug);
  if (!service) notFound();

  const [slots, credits] = await Promise.all([openSlots(service.id), privateCredits(service.id)]);

  const price = service.prices[0] ?? null;
  const shown = price ? formatPrice(price.amount, price.currency) : null;

  // Grouped by UK calendar day; formatted here so the client never reads a clock.
  const days: SlotDay[] = [];
  for (const slot of slots) {
    const start = new Date(slot.startsAt);
    const label = start.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: UK });
    const time = start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: UK });
    const last = days.at(-1);
    if (last?.label === label) last.slots.push({ id: slot.id, time });
    else days.push({ label, slots: [{ id: slot.id, time }] });
  }

  const submitLabel = credits > 0 ? "Book this time" : shown ? `Continue to payment · ${shown}` : "Continue to payment";

  return (
    <>
      {/* Back to where they most likely came from: somebody holding a session
          to book arrives from /bookings (or their account); anyone else from
          the service's page, via "Check availability". */}
      {credits > 0 ? (
        <BackLink href="/bookings">Book a session</BackLink>
      ) : (
        <BackLink href={`/coaching/private-coaching/${service.slug}`}>{service.name}</BackLink>
      )}

      <AccountHeader
        title="Choose a time"
        description={`${service.name} · ${service.duration_minutes} minutes with Tony, one to one. Times are UK time.`}
      />

      {credits > 0 ? (
        <p className="mb-8 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
          You have <span className="font-medium">{credits}</span> session{credits === 1 ? "" : "s"} to book —
          no payment needed.
        </p>
      ) : null}

      {days.length === 0 ? (
        <EmptyState icon="clock"
          title="No times open just now"
          description="New times are added regularly. Get in touch and we'll find one that suits you."
          action={<ButtonLink href="/contact">Get in touch</ButtonLink>}
        />
      ) : (
        <>
          <SlotPicker days={days} submitLabel={submitLabel} />
          <p className="mt-6 text-sm text-muted-foreground">
            {credits > 0
              ? "Booking uses one of your sessions."
              : "Your time is held for 30 minutes while you pay. If payment isn't completed, it's released."}{" "}
            Cancel at least 48 hours ahead and the session is returned to your account to rebook.
          </p>
        </>
      )}
    </>
  );
}
