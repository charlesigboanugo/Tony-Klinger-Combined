import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BookButton } from "@/app/bookings/BookButton";
import { PageHeader } from "@/components/layout/PageHeader";
import { BackLink } from "@/components/ui/BackLink";
import { sessionCredits } from "@/lib/academy";
import { getBookableSession } from "@/lib/bookings";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Confirm booking", robots: { index: false } };

export default async function ConfirmBookingPage({
  params,
}: PageProps<"/bookings/[bookableId]">) {
  const { bookableId } = await params;
  await requireUser(`/bookings/${bookableId}`);

  // Returns null when the session does not exist AND when RLS withheld it for
  // lack of entitlement — the same answer either way (note 06 §38).
  const session = await getBookableSession(bookableId);
  if (!session) notFound();

  const credits = await sessionCredits();

  return (
    <>
      <BackLink href="/bookings">All sessions</BackLink>

      <div className="mt-6">
        <PageHeader title={session.title} description={session.seriesName ?? undefined} />
      </div>

      <dl className="mb-6 grid gap-4 rounded-(--radius) border border-border bg-surface p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">When</dt>
          <dd className="mt-1 font-medium">
            {new Date(session.starts_at).toLocaleString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
              hour: "2-digit", minute: "2-digit",
            })}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Group size</dt>
          <dd className="mt-1 font-medium">Up to {session.capacity}</dd>
        </div>
      </dl>

      <BookButton sessionId={session.id} />

      <p className="mt-4 text-sm text-muted-foreground">
        {credits
          ? "Booking uses one session credit. Cancel at least 24 hours ahead and it's returned."
          : "This is covered by your access — booking it costs nothing extra."}
      </p>
    </>
  );
}
