import type { Metadata } from "next";
import Link from "next/link";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/Field";
import { FORMAT_LABEL, eventDay, eventTime, listCheckInEvents, type EventFormat } from "@/lib/content/events";
import { requirePermission } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils/cn";

import { checkInAction, saveJoiningAction } from "./actions";
import { Scanner } from "./Scanner";

export const metadata: Metadata = { title: "Check-in · Admin", robots: { index: false } };

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
        <AdminPageHeader title="Check-in" description="Choose an event to see its attendees and check people in." />
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
    supabase.from("events").select("id,name,slug,starts_at,ends_at,format,location,capacity").eq("id", eventId).maybeSingle(),
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

  return (
    <>
      <Link href="/admin/check-in" className="text-sm text-muted-foreground hover:text-accent">
        &larr; All events
      </Link>
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

      {done && doneRef ? (
        <div className="mt-6">
          <FormMessage tone={done === "ok" || done === "undone" ? "success" : undefined}>
            {done === "ok" ? `${doneRef} checked in.` : done === "undone" ? `${doneRef} check-in undone.` : done === "already" ? `${doneRef} was already checked in.` : `${doneRef}: ${done.replace(/_/g, " ")}.`}
          </FormMessage>
        </div>
      ) : null}


      {online ? (
        <section className="mt-8 rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card">
          <h2 className="font-display text-xl font-semibold">Joining link</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only ticket holders see this, on their ticket and in the reminder emails.
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
              <button type="submit" className="h-10 w-fit rounded-full bg-button px-5 text-sm font-semibold text-button-foreground">
                Save joining details
              </button>
            ) : null}
          </form>
        </section>
      ) : null}

      <div className="mt-8">
        <AdminTable
          headers={["Name", "Reference", "Ticket", "Arrived", ""]}
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
              <td className="px-4 py-3 text-right">
                {canWrite && a.reference ? (
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
                ) : null}
              </td>
            </tr>
          ))}
        </AdminTable>
      </div>
    </>
  );
}
