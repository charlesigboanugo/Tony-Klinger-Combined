import type { Metadata } from "next";
import Link from "next/link";

import { BackLink } from "@/components/ui/BackLink";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { CopyLink } from "@/components/admin/CopyLink";
import { FILLED_STATES, OUTLINE_STATES } from "@/components/ui/Button";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/Field";
import { FORMAT_LABEL, eventDay, eventTime, listCheckInEvents, type EventFormat } from "@/lib/content/events";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils/cn";

import { cancelTicketAction, checkInAction, saveJoiningAction, syncZoomAction } from "./actions";
import { Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Event check-in · Admin", robots: { index: false } };

type Attendee = Database["public"]["Functions"]["event_attendees"]["Returns"][number];

/**
 * Event day — migration 0018.
 *
 * Without `?event=`: the events to choose from, soonest first. With it: the
 * door's view of one event — how many are in, a box to type a ticket code, the
 * attendee list with a check-in button per person, and (for online events) the
 * private joining link that ticket holders see. The in-page Scanner checks
 * tickets in one after another, with typing the code as its backup; a QR code
 * scanned with a phone's own camera app opens /admin/check-in/[reference].
 */
export default async function CheckInPage({ searchParams }: PageProps<"/admin/check-in">) {
  const context = await requirePermission("events.read", "/admin/check-in");
  const canWrite = context.permissions.has("events.update");
  const params = await searchParams;
  const eventId = typeof params.event === "string" ? params.event : null;
  const supabase = await createClient();

  if (!eventId) {
    const events = await listCheckInEvents();

    return (
      <>
        <AdminPageHeader title="Event check-in" description="Choose an event to see its attendees and check people in." />
        <Scanner eventId={null} />
        {events.length > 0 ? (
          <div className="mt-8">
            <AdminTable headers={["Event", "When", "Format", "Status"]}>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/check-in?event=${e.id}`} className="font-medium hover:text-accent">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.starts_at ? eventDay(e.starts_at) : "No date"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{FORMAT_LABEL[e.format as EventFormat]}</td>
                  <td className="px-4 py-3"><StatusPill value={e.status} /></td>
                </tr>
              ))}
            </AdminTable>
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState icon="ticket" title="No upcoming events" description="Events from the last two days onwards are listed here." />
          </div>
        )}
      </>
    );
  }

  const [{ data: event }, { data: attendees }, { data: access }] = await Promise.all([
    supabase.from("events").select("id,name,slug,starts_at,ends_at,format,location,capacity,uses_zoom").eq("id", eventId).maybeSingle(),
    supabase.rpc("event_attendees", { p_event_id: eventId }),
    supabase.from("event_access").select("join_url,joining_notes").eq("event_id", eventId).maybeSingle(),
  ]);

  if (!event) {
    return <EmptyState icon="ticket" title="Event not found" description="It may have been deleted." />;
  }

  const list: Attendee[] = (attendees as Attendee[] | null) ?? [];
  const inRoom = list.filter((a) => a.checked_in_at).length;
  const done = typeof params.done === "string" ? params.done : null;
  const doneRef = typeof params.ref === "string" ? params.ref : null;
  const online = event.format !== "in_person";
  const onZoom = online && event.uses_zoom;

  // The Zoom meeting and how many tickets have their own link (0031).
  let zoomMeeting: { id: string; meeting_id: string | null; last_error: string | null } | null = null;
  let zoomLinks = 0;
  // Each ticket's own link, for staff helping someone whose link "doesn't work".
  const linkOf = new Map<string, string>();
  if (onZoom) {
    ({ data: zoomMeeting } = await supabase.from("zoom_meetings").select("id,meeting_id,last_error").eq("event_id", event.id).maybeSingle());
    if (zoomMeeting) {
      const { data: regs } = await supabase.from("zoom_registrants").select("booking_id,join_url").eq("meeting_row_id", zoomMeeting.id);
      for (const r of regs ?? []) linkOf.set(r.booking_id, r.join_url);
      zoomLinks = linkOf.size;
    }
  }
  const zoomCapacityWarning = onZoom && (event.capacity === null || event.capacity > 100);

  return (
    <>
      <BackLink href="/admin/check-in">All events</BackLink>
      <AdminPageHeader
        title={event.name}
        description={`${event.starts_at ? `${eventDay(event.starts_at)}, ${eventTime(event.starts_at, event.ends_at)} UK` : "No date"} · ${FORMAT_LABEL[event.format as EventFormat]}${event.location ? ` · ${event.location}` : ""}`}
      />

      {/* The scanner first: on a phone at the door it is the whole job. */}
      <div className="mb-6">
        <Scanner eventId={event.id} />
      </div>

      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Tickets", value: `${list.length}${event.capacity ? ` of ${event.capacity}` : ""}` },
          { label: "Checked in", value: String(inRoom) },
          { label: "Still to arrive", value: String(list.length - inRoom) },
        ].map((s) => (
          <div key={s.label} className="rounded-(--radius-lg) border border-border bg-surface p-3 shadow-card sm:p-5">
            <dt className="text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase sm:text-[0.6875rem]">{s.label}</dt>
            <dd className="mt-1 font-display text-xl font-semibold tabular-nums sm:mt-2 sm:text-3xl">{s.value}</dd>
          </div>
        ))}
      </dl>

      {typeof params.cancelled === "string" ? (
        <div className="mt-6">
          <FormMessage tone={params.cancelled === "ok" ? "success" : undefined}>
            {params.cancelled === "ok"
              ? `${params.ref} cancelled. The holder has been emailed.`
              : params.cancelled === "already"
                ? `${params.ref} was already cancelled.`
                : params.cancelled === "no_reason"
                  ? "Give a reason to cancel a ticket."
                  : "That ticket couldn't be cancelled. Please try again."}
          </FormMessage>
        </div>
      ) : null}

      {done && doneRef ? (
        <div className="mt-6">
          <FormMessage tone={done === "ok" || done === "undone" ? "success" : undefined}>
            {done === "ok" ? `${doneRef} checked in.` : done === "undone" ? `${doneRef} check-in undone.` : done === "already" ? `${doneRef} was already checked in.` : `${doneRef}: ${done.replace(/_/g, " ")}.`}
          </FormMessage>
        </div>
      ) : null}


      {onZoom ? (
        <section className="mt-8 rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">Zoom</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every ticket holder gets their own joining link, on their ticket and in the
            reminder emails. Each link works on one device at a time.
          </p>
          {params.zoom === "synced" ? <div className="mt-3"><FormMessage tone="success">Synced with Zoom.</FormMessage></div> : null}
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Meeting ID</dt>
              <dd className="mt-0.5 font-mono font-semibold tracking-wider">
                {zoomMeeting?.meeting_id ? zoomMeeting.meeting_id.replace(/(\d{3})(\d{3,4})(\d{4})$/, "$1 $2 $3") : "Not created yet"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Personal links</dt>
              <dd className="mt-0.5 font-semibold">{zoomLinks} of {list.length} tickets</dd>
            </div>
          </dl>
          {zoomMeeting?.last_error ? (
            <div className="mt-3">
              <FormMessage>Zoom refused the last attempt: {zoomMeeting.last_error}. It is retried every five minutes.</FormMessage>
            </div>
          ) : null}
          {zoomCapacityWarning ? (
            <div className="mt-3">
              <FormMessage>
                Zoom Pro holds 100 people. Set Places to 100 or fewer on this event, or anyone past
                the hundredth will be turned away by Zoom.
              </FormMessage>
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            Tony starts the meeting from his Zoom app as usual. Compare the names in the meeting
            with the list below.
          </p>
          {canWrite ? (
            <form action={syncZoomAction} className="mt-4">
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className={`h-10 rounded-full border border-input-border px-5 text-sm font-semibold ${OUTLINE_STATES}`}>
                Sync with Zoom now
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {online ? (
        <section className="mt-8 rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">{onZoom ? "Joining notes" : "Joining link"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {onZoom
              ? "Shown to ticket holders with their own link. A link saved here is not shown while the event runs on Zoom."
              : "Only ticket holders see this, on their ticket and in the reminder emails."}
          </p>
          {params.joining === "saved" ? <div className="mt-3"><FormMessage tone="success">Saved.</FormMessage></div> : null}
          {params.joining === "invalid" ? <div className="mt-3"><FormMessage>That link must start with https://</FormMessage></div> : null}
          {params.joining === "failed" ? <div className="mt-3"><FormMessage>It couldn&apos;t be saved. Please try again.</FormMessage></div> : null}
          <form action={saveJoiningAction} className="mt-4 grid gap-3">
            <input type="hidden" name="eventId" value={event.id} />
            <label className="grid gap-1 text-sm font-medium">
              Link (Zoom, Teams, YouTube…)
              <input
                name="joinUrl"
                type="url"
                defaultValue={access?.join_url ?? ""}
                placeholder="https://"
                disabled={!canWrite}
                className="h-11 rounded-(--radius) border border-border bg-background px-3 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Notes for attendees (passcode, what to have ready)
              <textarea
                name="joiningNotes"
                rows={2}
                defaultValue={access?.joining_notes ?? ""}
                disabled={!canWrite}
                className="rounded-(--radius) border border-border bg-background px-3 py-2 font-normal"
              />
            </label>
            {canWrite ? (
              <button type="submit" className={`h-10 w-fit rounded-full bg-button px-5 text-sm font-semibold text-button-foreground transition-[filter,transform,box-shadow,background-color,border-color,color] duration-200 ease-out active:scale-96 ${FILLED_STATES}`}>
                Save joining details
              </button>
            ) : null}
          </form>
        </section>
      ) : null}

      <div className="mt-8">
        <AdminTable
          headers={onZoom ? ["Name", "Reference", "Ticket", "Arrived", "Zoom link", ""] : ["Name", "Reference", "Ticket", "Arrived", ""]}
          empty={list.length === 0 ? "No tickets yet." : undefined}
        >
          {list.map((a) => (
            <tr key={a.booking_id} className={cn(a.checked_in_at && "bg-success/5")}>
              <td className="px-4 py-3">
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.email}</p>
              </td>
              <td className="px-4 py-3 font-mono tracking-wider">{a.reference}</td>
              <td className="px-4 py-3 text-muted-foreground">{a.paid ? "Paid" : "Free"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {a.checked_in_at
                  ? new Date(a.checked_in_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
                  : "—"}
              </td>
              {onZoom ? (
                <td className="max-w-64 px-4 py-3">
                  {linkOf.get(a.booking_id) ? (
                    <CopyLink url={linkOf.get(a.booking_id)!} label={`${a.name}'s Zoom link`} />
                  ) : (
                    <span className="text-muted-foreground">No link yet</span>
                  )}
                </td>
              ) : null}
              <td className="px-4 py-3 text-right">
                {canWrite && a.reference ? (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                  <form action={checkInAction}>
                    <input type="hidden" name="reference" value={a.reference} />
                    <input type="hidden" name="back" value="list" />
                    {a.checked_in_at ? <input type="hidden" name="undo" value="1" /> : null}
                    <button
                      type="submit"
                      className={cn(
                        "h-9 rounded-full px-4 text-sm font-semibold",
                        a.checked_in_at ? "border border-border text-muted-foreground hover:text-foreground" : "bg-button text-button-foreground",
                      )}
                    >
                      {a.checked_in_at ? "Undo" : "Check in"}
                    </button>
                  </form>
                  {/* Paid or free (migration 0033); asks first, with a reason for the log. */}
                  <form action={cancelTicketAction}>
                    <input type="hidden" name="bookingId" value={a.booking_id} />
                    <input type="hidden" name="eventId" value={event.id} />
                    <ConfirmSubmit
                      variant="outline"
                      size="sm"
                      destructive
                      title={`Cancel ${a.name}'s ticket?`}
                      confirmLabel="Cancel the ticket"
                      cancelLabel="Keep it"
                      pendingLabel="Cancelling…"
                      points={[
                        `Ticket ${a.reference} stops admitting them, and they are emailed to say so.`,
                        a.paid
                          ? "It does not refund them. Refund the payment in Stripe; the email says we will be in touch about it."
                          : "It was free, so there is nothing to refund.",
                        "If anyone is on the waiting list, the next person is told a place is free.",
                        ...(onZoom ? ["Their own Zoom link stops working."] : []),
                      ]}
                      note={
                        <label className="block text-foreground">
                          <span className="font-medium">Reason</span>{" "}
                          <span className="text-muted-foreground">(kept in the audit log)</span>
                          <input
                            name="reason"
                            required
                            defaultValue="Cancelled at the ticket holder's request"
                            className="mt-1.5 h-10 w-full rounded-(--radius) border border-input-border bg-background px-3 text-sm"
                          />
                        </label>
                      }
                    >
                      Cancel
                    </ConfirmSubmit>
                  </form>
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </>
  );
}
