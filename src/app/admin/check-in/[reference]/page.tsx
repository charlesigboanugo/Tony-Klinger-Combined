import type { Metadata } from "next";

import { BackLink } from "@/components/ui/BackLink";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { eventDay, eventTime, isTodayInUk } from "@/lib/content/events";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils/cn";

import { checkInAction } from "../actions";

export const metadata: Metadata = { title: "Ticket · Check-in", robots: { index: false } };

/**
 * What the door sees after scanning a ticket's QR code (or typing its code).
 *
 * Made for a phone held at a door: one large verdict, the person's name, the
 * event, and one button. Checking in is a deliberate tap, not a side effect of
 * opening the page, so a second scan or a prefetch never checks anyone in by
 * accident, and the verdict says plainly when a ticket was already used,
 * cancelled, or is for a different event.
 */
export default async function TicketCheckPage({
  params,
  searchParams,
}: PageProps<"/admin/check-in/[reference]">) {
  const { reference: raw } = await params;
  const reference = decodeURIComponent(raw).toUpperCase();
  await requirePermission("events.read", `/admin/check-in/${reference}`);
  const { done } = await searchParams;

  // The lookup itself is read-only and runs only after the permission check.
  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id,status,checked_in_at,bookable_id,entitlement_id")
    .eq("reference", reference)
    .eq("bookable_type", "event")
    .maybeSingle();

  const supabase = await createClient();
  const [{ data: event }, { data: attendees }] = booking
    ? await Promise.all([
        admin.from("events").select("id,name,starts_at,ends_at").eq("id", booking.bookable_id).maybeSingle(),
        supabase.rpc("event_attendees", { p_event_id: booking.bookable_id }),
      ])
    : [{ data: null }, { data: null }];
  type Attendee = Database["public"]["Functions"]["event_attendees"]["Returns"][number];
  const person = (attendees as Attendee[] | null)?.find((a) => a.reference === reference);

  const today = isTodayInUk(event?.starts_at);

  const verdict = !booking
    ? { tone: "bad", text: "No such ticket" }
    : booking.status === "cancelled"
      ? { tone: "bad", text: "Cancelled ticket" }
      : booking.checked_in_at
        ? { tone: "warn", text: done === "ok" ? "Checked in" : "Already checked in" }
        : { tone: "ready", text: today ? "Valid ticket" : "Valid ticket, different day" };

  return (
    <div className="mx-auto max-w-md">
      <BackLink href={event ? `/admin/check-in?event=${event.id}` : "/admin/check-in"}>
        {event ? "Attendee list" : "Check-in"}
      </BackLink>

      <div
        className={cn(
          "rounded-(--radius-lg) p-8 text-center",
          verdict.tone === "bad" && "bg-error/12 text-error",
          verdict.tone === "warn" && (done === "ok" ? "bg-success/12 text-success" : "bg-warning/12 text-warning"),
          verdict.tone === "ready" && "bg-surface shadow-lift",
        )}
      >
        <p className="font-display text-3xl font-semibold">{verdict.text}</p>
        <p className="mt-2 font-mono tracking-wider">{reference}</p>
      </div>

      {booking && event ? (
        <div className="mt-6 space-y-1 text-center">
          <p className="text-2xl font-semibold">{person?.name ?? "Ticket holder"}</p>
          <p className="text-muted-foreground">{event.name}</p>
          <p className="text-sm text-muted-foreground">
            {event.starts_at ? `${eventDay(event.starts_at)}, ${eventTime(event.starts_at, event.ends_at)}` : "No date"}
            {" · "}
            {booking.entitlement_id ? "Paid" : "Free"}
          </p>
          {booking.checked_in_at ? (
            <p className="text-sm text-muted-foreground">
              Arrived{" "}
              {new Date(booking.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
            </p>
          ) : null}
        </div>
      ) : null}

      {booking && booking.status !== "cancelled" ? (
        <form action={checkInAction} className="mt-8">
          <input type="hidden" name="reference" value={reference} />
          {booking.checked_in_at ? <input type="hidden" name="undo" value="1" /> : null}
          <button
            type="submit"
            className={cn(
              "h-14 w-full rounded-full text-lg font-semibold",
              booking.checked_in_at ? "border border-border text-muted-foreground" : "bg-button text-button-foreground",
            )}
          >
            {booking.checked_in_at ? "Undo check-in" : "Check in"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
