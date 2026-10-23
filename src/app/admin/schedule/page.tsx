import type { Metadata } from "next";
import Link from "next/link";

import { ScheduleForm } from "@/app/admin/schedule/ScheduleForm";
import { AdminGroupSection } from "@/components/admin/AdminGroupSection";
import { AdminReveal } from "@/components/admin/AdminReveal";
import { AdminSort } from "@/components/admin/AdminSort";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch, FilterTabs, ukDate } from "@/components/admin/AdminUI";
import { lifecycles, resourceBySlug, splitByPast } from "@/lib/admin/resources";
import { readQuery, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Series runs · Admin", robots: { index: false } };

type Run = {
  id: string;
  label: string;
  pass_opens_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  status: string;
  series_id: string;
  group_coaching_series: { name: string } | null;
  coaching_registrations: Array<{ count: number }>;
};

/**
 * Create and see the runs of each Group Coaching series — migration 0016,
 * note 07 §14.2.
 *
 * A run is one running of a series: eight weekly sessions between a start and
 * an end date, registered for before it starts. When a run is full, create a
 * second for the same series at another day and time.
 *
 * BUILT LIKE THE OTHER ADMIN LISTS (owner, 2026-10-14). It was a hand-made
 * page: each run one line of grey text in a box, "dates · pass holders from ·
 * registration … · 3 of 8 registered · published", hard to scan and unlike
 * every other list. Now it is a table under a band per series, with the dates,
 * registration window and places in their own columns, the status coloured
 * like everywhere else (Scheduled, Running, Completed), search, sort, and a
 * Past tab for runs that have finished. Every series appears, even one with
 * nothing to come. Each run opens on its edit page.
 */
export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("coaching.manage", "/admin/schedule");
  const params = await searchParams;
  const query = readQuery(params);
  const when = params.when === "past" ? "past" : undefined;
  const admin = createAdminClient();
  const runsResource = resourceBySlug("runs")!;

  const [{ data: series }, { data: runs }] = await Promise.all([
    admin.from("group_coaching_series").select("id,name,syllabus").order("name"),
    admin
      .from("coaching_runs")
      .select(
        "id,label,pass_opens_at,registration_opens_at,registration_closes_at,starts_at,ends_at,capacity,status,series_id,group_coaching_series(name),coaching_registrations(count)",
      )
      .order("starts_at"),
  ]);

  const all = (runs ?? []) as unknown as Run[];
  const split = splitByPast(runsResource, all);
  const tab = when === "past" ? split.past : split.current;
  const stage = lifecycles(runsResource, all);
  const registered = (r: Run) => r.coaching_registrations?.[0]?.count ?? 0;

  const found = searchRows(tab, query, (r) => [r.group_coaching_series?.name, r.label]);
  const sort = readSort(params, ["starts", "registered", "run"], query ? undefined : { key: "starts", dir: "asc" });
  const sorted = sortRows(found, sort, {
    starts: (r) => r.starts_at,
    registered: (r) => registered(r),
    run: (r) => r.label,
  });
  const carry = { q: query, sort: sort?.key, dir: sort?.dir, when };

  // A band per series, every series included while nothing narrows the list,
  // so one with no run to come is still seen.
  const showEmpty = !query && when !== "past";
  const groups = (series ?? [])
    .map((s) => ({ id: s.id, name: s.name, items: sorted.filter((r) => r.series_id === s.id) }))
    .filter((g) => g.items.length > 0 || showEmpty);

  const columns = 6;

  return (
    <>
      <AdminPageHeader
        title="Series runs"
        meta={`${split.current.length} current`}
        description="A run is one running of a series: eight weekly sessions. The full series is sold while registration is open; after it closes, the seats left are sold as single sessions."
      />

      <FilterTabs
        path="/admin/schedule"
        param="when"
        current={when}
        label="Current or finished"
        keep={{ q: query, sort: sort?.key, dir: sort?.dir }}
        options={[
          { value: undefined, label: "Current", count: split.current.length },
          { value: "past", label: "Past", count: split.past.length },
        ]}
      />

      {/* The runs first; creating one is a button that opens the form. */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminSearch
            path="/admin/schedule"
            query={query}
            label="Find a series or run"
            placeholder="Series or run"
            keep={{ ...carry, q: undefined }}
          />
          <AdminSort
            path="/admin/schedule"
            state={sort}
            params={{ q: query, when }}
            unsorted={query ? { label: "Best match" } : undefined}
            options={[
              { label: "Starts soonest", key: "starts", dir: "asc" },
              { label: "Starts latest", key: "starts", dir: "desc" },
              { label: "Most registered", key: "registered", dir: "desc" },
              { label: "Run name A to Z", key: "run", dir: "asc" },
            ]}
          />
        </div>
        <AdminReveal
          label="Create a run"
          title="Create a run"
          description="Makes the run and its weekly sessions: the first at the time you give, then one a week, each titled with its topic."
        >
          <ScheduleForm
            series={(series ?? []).map((s) => ({
              id: s.id,
              name: s.name,
              sessions: Array.isArray(s.syllabus) && s.syllabus.length > 0 ? s.syllabus.length : 8,
            }))}
          />
        </AdminReveal>
      </div>

      <AdminTable
        sectioned
        headers={[
          { label: "Run", key: "run" },
          { label: "Dates", key: "starts" },
          "Registration",
          { label: "Places", key: "registered", first: "desc" },
          "Status",
          "",
        ]}
        sort={{ path: "/admin/schedule", state: sort, params: { q: query, when } }}
        empty={
          groups.length === 0
            ? query
              ? `Nothing matches “${query}”.`
              : when === "past"
                ? "No run has finished yet."
                : "No series yet."
            : undefined
        }
      >
        {groups.map((g) => (
          <AdminGroupSection key={g.id} label={g.name} count={g.items.length} colSpan={columns}>
            {g.items.length === 0 ? (
              <tr>
                <td colSpan={columns} className="px-4 py-3 text-sm text-muted-foreground">
                  No run to come. Use Create a run to put this series on sale.
                </td>
              </tr>
            ) : (
              g.items.map((r) => {
                const taken = registered(r);
                const full = taken >= r.capacity;
                return (
                  <tr key={r.id} className="hover:bg-surface-muted/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/runs/${r.id}`} className="font-medium hover:text-accent">
                        {r.label}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        Pass holders from {ukDate(r.pass_opens_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ukDate(r.starts_at)}
                      <span className="block text-xs text-muted-foreground">to {ukDate(r.ends_at)}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ukDate(r.registration_opens_at)}
                      <span className="block text-xs text-muted-foreground">
                        to {ukDate(r.registration_closes_at)}, then single sessions
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                      <span className={full ? "font-semibold" : undefined}>
                        {taken} of {r.capacity}
                      </span>
                      {full ? <span className="block text-xs text-muted-foreground">Full</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill value={stage.get(r.id) ?? r.status} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        href={`/admin/runs/${r.id}`}
                        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Edit
                      </Link>
                      <span aria-hidden="true" className="mx-2 text-muted-foreground">
                        ·
                      </span>
                      <Link
                        href={`/admin/registrations?q=${encodeURIComponent(`${r.label} ${g.name}`)}`}
                        title="See who is registered"
                        className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                      >
                        Who
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </AdminGroupSection>
        ))}
      </AdminTable>
    </>
  );
}
