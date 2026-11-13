import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, ukDateTime } from "@/components/admin/AdminUI";
import { CopyLink } from "@/components/admin/CopyLink";
import { BackLink } from "@/components/ui/BackLink";
import { FormMessage } from "@/components/ui/Field";
import { requirePermission } from "@/lib/permissions";
import { ZOOM_KIND_LABEL, zoomPeople, type ZoomKind } from "@/lib/zoom/overview";

export const metadata: Metadata = { title: "Zoom meeting · Admin", robots: { index: false } };

const EDIT_PATH: Record<ZoomKind, string> = {
  event: "/admin/events",
  group: "/admin/sessions",
  workshop: "/admin/workshops",
  qa: "/admin/qa-sessions",
  retreat: "/admin/retreat-batches",
  private: "/admin/coaching-slots",
};

/**
 * One Zoom meeting: everyone on it and their own link (owner, 2026-11-13), for
 * helping someone whose link "doesn't work". Links are copied, never opened
 * here (see `CopyLink`). Zoom's own site lists the registrants but not their
 * links, so this is the one place staff can find them.
 */
export default async function ZoomMeetingPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  await requirePermission("coaching.read", "/admin/zoom");
  const { kind, id } = await params;
  if (!(kind in ZOOM_KIND_LABEL)) notFound();
  const detail = await zoomPeople(kind as ZoomKind, id);
  if (!detail) notFound();

  const waiting = detail.people.filter((p) => !p.link).length;

  return (
    <>
      <BackLink href="/admin/zoom">All Zoom meetings</BackLink>
      <AdminPageHeader
        title={detail.title}
        meta={ZOOM_KIND_LABEL[kind as ZoomKind]}
        description={[
          detail.startsAt ? `${ukDateTime(detail.startsAt)} UK` : null,
          detail.meetingId ? `Meeting ID ${detail.meetingId.replace(/(\d{3})(\d{3,4})(\d{4})$/, "$1 $2 $3")}` : "No meeting yet",
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <Link href={`${EDIT_PATH[kind as ZoomKind]}/${id}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">
            Open the {kind === "event" ? "event" : "session"}
          </Link>
        }
      />

      {detail.lastError ? (
        <div className="mb-4">
          <FormMessage>Zoom refused the last attempt: {detail.lastError}. It is retried every five minutes.</FormMessage>
        </div>
      ) : null}

      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        {kind === "private"
          ? "One meeting for the client who booked; its link is also on the coaching time."
          : "Each person's own link works on one device at a time. Copy it to send to them; opening it yourself would join the meeting as them."}
        {waiting && kind !== "private"
          ? ` ${waiting} ${waiting === 1 ? "person is" : "people are"} still waiting for a link: people are registered from 14 days before a session, and straight away for event tickets.`
          : ""}
      </p>

      {kind === "private" && detail.plainLink ? (
        <div className="mb-6">
          <CopyLink url={detail.plainLink} label="the meeting link" />
        </div>
      ) : null}

      <AdminTable
        headers={["Name", "Email", kind === "private" ? "" : "Their own link"]}
        empty={detail.people.length === 0 ? "Nobody is on it yet." : undefined}
      >
        {detail.people.map((p) => (
          <tr key={p.userId} className="align-top hover:bg-surface-muted/60">
            <td className="px-4 py-3">
              <Link href={`/admin/users/${p.userId}`} className="font-medium hover:text-accent">
                {p.name ?? p.email ?? "Unknown"}
              </Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{p.email ?? "—"}</td>
            <td className="max-w-md px-4 py-3">
              {kind === "private" ? null : p.link ? (
                <CopyLink url={p.link} label={`${p.name ?? p.email ?? "their"}'s link`} />
              ) : (
                <span className="text-muted-foreground">No link yet</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
