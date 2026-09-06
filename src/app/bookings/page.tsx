import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { sessionCredits } from "@/lib/academy";
import { bookableSessions } from "@/lib/bookings";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Book a session", robots: { index: false } };

/**
 * What this customer can book — note 03 §11.
 *
 * Distinct from /account/bookings, which manages bookings already made.
 */
export default async function BookingsPage() {
  await requireUser("/bookings");
  const [sessions, credits] = await Promise.all([bookableSessions(), sessionCredits()]);

  return (
    <>
      <PageHeader
        title="Book a session"
        description="Sessions your access covers. Booking one doesn't cost anything extra."
      />

      {credits ? (
        <p className="mb-6 rounded-(--radius) border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium">{credits.remaining}</span> session credit
          {credits.remaining === 1 ? "" : "s"} remaining.
        </p>
      ) : null}

      {sessions.length === 0 ? (
        <EmptyState
          title="Nothing available to book"
          description="Either no sessions are scheduled, or your current access doesn't cover any."
          action={<ButtonLink href="/coaching/group-coaching">See group coaching</ButtonLink>}
        />
      ) : (
        <ul className="divide-y divide-border rounded-(--radius) border border-border bg-surface">
          {sessions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {s.seriesName} ·{" "}
                  {new Date(s.starts_at).toLocaleString("en-GB", {
                    weekday: "short", day: "numeric", month: "short",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <Link
                href={`/bookings/${s.id}`}
                className="rounded-(--radius) border border-border px-3 py-1.5 text-sm hover:bg-surface-muted"
              >
                Choose
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
