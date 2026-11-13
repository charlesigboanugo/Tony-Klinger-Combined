import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, FilterTabs, ukDateTime } from "@/components/admin/AdminUI";
import { OUTLINE_STATES } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { applyFilters, readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";
import { zoomConfigured } from "@/lib/zoom/client";
import { ZOOM_KIND_LABEL, zoomOverview } from "@/lib/zoom/overview";

import { syncAllZoomAction } from "./actions";

export const metadata: Metadata = { title: "Zoom · Admin", robots: { index: false } };

/**
 * Every event and session run on Zoom — note 09 §40.2, migrations 0031–0032.
 *
 * Where to look when someone says their link is missing: whether the meeting
 * was made, how many people have their own link, what Zoom last refused, and
 * which meetings overlap (Tony's account hosts one at a time). Each row opens
 * the event or session it belongs to, where Zoom is switched on or off.
 */
export default async function AdminZoomPage({ searchParams }: PageProps<"/admin/zoom">) {
  await requirePermission("coaching.read", "/admin/zoom");
  const params = await searchParams;
  const past = params.tab === "past";
  const query = readQuery(params);

  const loaded = await zoomOverview(past);
  const searched = searchRows(loaded, query, (r) => [r.title, ZOOM_KIND_LABEL[r.kind], r.meetingId]);
  const sort = readSort(params, ["when", "what", "kind"]);
  const f = applyFilters(searched, params, [
    { key: "kind", name: "Kind", read: (r) => r.kind, label: (k) => ZOOM_KIND_LABEL[k as keyof typeof ZOOM_KIND_LABEL] ?? k },
  ]);
  const tab = past ? "past" : undefined;
  const carry = { tab, sort: sort?.key, dir: sort?.dir, ...f.active, q: query };
  const rows = sortRows(f.rows, sort, {
    when: (r) => r.startsAt,
    what: (r) => r.title,
    kind: (r) => ZOOM_KIND_LABEL[r.kind],
  });
  const clashes = past ? 0 : loaded.filter((r) => r.clashes.length).length;
  const errors = past ? 0 : loaded.filter((r) => r.error).length;

  return (
    <>
      <AdminPageHeader
        title="Zoom"
        description="Events and sessions run on Zoom. The site makes each meeting and gives every person on it their own joining link; private coaching gets one link once the time is booked. Switch Zoom on or off on the event or session itself."
      />

      {!zoomConfigured() ? (
        <div className="mb-4">
          <FormMessage>Zoom is not connected on this site: the three Zoom keys are missing, so no meetings are made.</FormMessage>
        </div>
      ) : null}
      {params.synced === "ok" ? <div className="mb-4"><FormMessage tone="success">Synced with Zoom.</FormMessage></div> : null}
      {params.synced === "with-errors" ? <div className="mb-4"><FormMessage>Synced, but Zoom refused some. The rows below say why.</FormMessage></div> : null}
      {clashes ? (
        <div className="mb-4">
          <FormMessage>
            {clashes} upcoming {clashes === 1 ? "meeting overlaps" : "meetings overlap"} another. Tony&apos;s Zoom account can
            host one meeting at a time, so move one of them, or host it from a second Zoom licence.
          </FormMessage>
        </div>
      ) : null}
      {errors ? (
        <div className="mb-4">
          <FormMessage>
            Zoom refused the last attempt for {errors} {errors === 1 ? "item" : "items"}. Each is retried every five minutes.
          </FormMessage>
        </div>
      ) : null}

      <FilterTabs
        label="Current or past Zoom meetings"
        path="/admin/zoom"
        param="tab"
        current={tab}
        keep={{ sort: sort?.key, dir: sort?.dir, ...f.active, q: query }}
        options={[
          { value: undefined, label: "Current" },
          { value: "past", label: "Past" },
        ]}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <AdminSearch
          path="/admin/zoom"
          query={query}
          label="Title, kind or meeting ID"
          placeholder="Title, kind or meeting ID"
          keep={{ ...carry, q: undefined }}
        />
        <AdminSort
          path="/admin/zoom"
          state={sort}
          params={{ tab, ...f.active, q: query }}
          unsorted={{ label: query ? "Best match" : past ? "Latest first" : "Soonest first" }}
          options={[
            { label: "Soonest first", key: "when", dir: "asc" },
            { label: "Latest first", key: "when", dir: "desc" },
            { label: "Title A to Z", key: "what", dir: "asc" },
            { label: "Kind", key: "kind", dir: "asc" },
          ]}
        />
        {f.controls.map((c) => (
          <AdminFilter key={c.param} path="/admin/zoom" {...c} params={carry} />
        ))}
        {!past ? (
          <form action={syncAllZoomAction} className="ml-auto">
            <button type="submit" className={`h-10 rounded-full border border-input-border px-5 text-sm font-semibold ${OUTLINE_STATES}`}>
              Sync with Zoom now
            </button>
          </form>
        ) : null}
      </div>

      <AdminTable
        headers={[
          { label: "When", key: "when", first: "asc" },
          { label: "What", key: "what" },
          { label: "Kind", key: "kind" },
          "Meeting ID",
          "Own links",
          "Status",
        ]}
        sort={{ path: "/admin/zoom", state: sort, params: { tab, ...f.active, q: query } }}
        empty={rows.length === 0 ? (query ? `Nothing matches “${query}”.` : past ? "None yet." : "Nothing is on Zoom yet. Switch Run on Zoom on for an event or session.") : undefined}
      >
        {rows.map((r) => (
          <tr key={r.key} className="align-top hover:bg-surface-muted/60">
            <td className="px-4 py-3 whitespace-nowrap">{ukDateTime(r.startsAt)}</td>
            <td className="px-4 py-3">
              <Link href={r.href} className="font-medium hover:text-accent">{r.title}</Link>
            </td>
            <td className="px-4 py-3 text-muted-foreground">{ZOOM_KIND_LABEL[r.kind]}</td>
            <td className="px-4 py-3 font-mono whitespace-nowrap">
              {r.meetingId ? r.meetingId.replace(/(\d{3})(\d{3,4})(\d{4})$/, "$1 $2 $3") : "—"}
            </td>
            <td className="px-4 py-3 text-muted-foreground">{r.links === null ? "One link" : r.links}</td>
            <td className="max-w-80 px-4 py-3 text-xs">
              {r.error ? (
                <span className="text-error">{r.error}</span>
              ) : r.clashes.length ? (
                <span className="text-error">Overlaps {r.clashes.join(", ")}</span>
              ) : r.meetingId ? (
                <span className="text-success">Ready</span>
              ) : r.kind === "private" ? (
                <span className="text-muted-foreground">Made once booked</span>
              ) : (
                <span className="text-muted-foreground">Being made</span>
              )}
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}
