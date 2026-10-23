import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminFilter, AdminSort } from "@/components/admin/AdminSort";
import { AdminGroupSection } from "@/components/admin/AdminGroupSection";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminPager, AdminSearch, FilterTabs } from "@/components/admin/AdminUI";
import { ButtonLink } from "@/components/ui/Button";
import { withFrom } from "@/lib/admin/back";
import { finishedParents, listReferences, listRows, parentsWithoutGroups } from "@/lib/admin/crud";
import { codeLabel } from "@/lib/admin/labels";
import { isUserColumn, peopleByIds } from "@/lib/admin/operations";
import { lifecycles, resourceBySlug, splitByPast, type FieldType } from "@/lib/admin/resources";
import { applyFilters, filterOptions, readSort, searchRows, sortRows } from "@/lib/admin/sort";
import { requirePermission } from "@/lib/permissions";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { groupBy } from "@/lib/utils/group";

/**
 * Generic admin list — note 06 §14, §16.
 *
 * One dynamic route serves every managed resource, because the pages differed
 * only in which table they read and which permission they required, and both
 * are data (note 03 §35). A hand-written page per area is how twenty areas
 * drift into behaving differently from one another.
 *
 * The slug comes from the URL, so it is resolved against the declared registry
 * and anything unrecognised is a 404 — never used to build a query.
 */
/** Tiles on one page of a tiled list (Media). */
const GALLERY_PAGE = 60;
/** A tiled list is read in full, as far as one request allows. */
const GALLERY_DEPTH = 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resource: string }>;
}): Promise<Metadata> {
  const { resource: slug } = await params;
  const resource = resourceBySlug(slug);
  return {
    title: resource ? `${resource.label} · Admin` : "Admin",
    robots: { index: false },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { resource: slug } = await params;
  const search = await searchParams;
  const { q } = search;
  const query = typeof q === "string" && q.trim() ? q.trim() : undefined;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  await requirePermission(resource.permissions.read, `/admin/${resource.slug}`);
  const [allRows, references, doneParents, bareParents] = await Promise.all([
    listRows(resource, resource.gallery ? GALLERY_DEPTH : undefined),
    listReferences(resource),
    finishedParents(resource),
    parentsWithoutGroups(resource),
  ]);
  const path = `/admin/${resource.slug}`;
  // A tiled list is split by kind (Images, Videos, Audio…), one switch each,
  // opening on the first; the kind is in the URL, like the search and the sort.
  const kindColumn = resource.gallery ? resource.galleryKind : undefined;
  const kinds = (kindColumn && resource.fields.find((f) => f.name === kindColumn)?.options) || [];
  const kind =
    typeof search.type === "string" && kinds.includes(search.type) && search.type !== kinds[0]
      ? search.type
      : undefined;
  const shownKind = kinds.length > 0 ? (kind ?? kinds[0]) : undefined;
  const kindLabel = (value: string) => codeLabel(value) + (value === "audio" ? "" : "s");

  // Current or finished rows, for an area whose rows finish (`past`): the list
  // opens on what is still to come or running, with the rest under "Past".
  const when = resource.past && !resource.past.currentOnly && search.when === "past" ? "past" : undefined;
  const split = splitByPast(resource, allRows);
  const pastCount = split.past.length;
  const rows = when === "past" ? split.past : split.current;
  // The status shown for a dated row: Draft, Published, Running, Completed or
  // Cancelled, worked out from its dates (note 10 §33).
  const stage = lifecycles(resource, allRows);
  // The first listed column carrying the row's name becomes the link to it.
  const titleColumn =
    resource.titleField && resource.columns.includes(resource.titleField)
      ? resource.titleField
      : resource.columns[0];

  // A listed foreign key reads as the name it points at, not a uuid; a
  // date-time column keeps its time (coaching times are all on one day).
  const typeOf = new Map(resource.fields.map((f) => [f.name, f.type]));
  const labelOf = new Map(
    Object.values(references).flatMap((options) => options.map((o) => [o.id, o.label] as const)),
  );

  // A column holding an account's id reads as that person's EMAIL (owner,
  // 2026-10-13): unique like the id, and something staff can recognise, search
  // for and sort by. The id is kept only where there is no email to show.
  const userColumns = new Set(resource.columns.filter(isUserColumn));
  if (userColumns.size > 0) {
    const ids = allRows.flatMap((row) => [...userColumns].map((c) => (row[c] ? String(row[c]) : null)));
    for (const [id, person] of await peopleByIds(ids)) {
      if (person.email ?? person.name) labelOf.set(id, (person.email ?? person.name) as string);
    }
  }
  // Reads as a label rather than the stored value: a reference, or a person.
  const named = (column: string) => typeOf.get(column) === "reference" || userColumns.has(column);
  const heading = (column: string) => (userColumns.has(column) ? "Customer" : humanise(column));

  // Every listed column sorts (note 10 §33.1). A reference sorts by the name
  // shown, not the uuid behind it; dates and numbers start newest/largest.
  const sortValue = (column: string) => (row: (typeof rows)[number]) => {
    const value = column === "status" && resource.past ? stage.get(String(row.id)) : row[column];
    if (named(column)) return labelOf.get(String(value)) ?? (userColumns.has(column) && value ? String(value) : null);
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return value == null ? null : String(value);
  };
  // Sorted by what the resource offers (all its columns, unless it names
  // `sortColumns`). The sort in the URL is what is carried between pages; with
  // none, the list opens in its `defaultSort`, or best match while searching.
  const sortable = resource.sortColumns ?? resource.columns;
  const sortParam = readSort(search, sortable);
  const sort = sortParam ?? (query ? undefined : resource.defaultSort);

  // Search runs over the text SHOWN in the list, so what you can see is what
  // you can find: the name a reference points at rather than its id, a choice
  // as its words ("Group coaching") as well as its code. Every word typed must
  // appear; the closest matches come first, the row's name counting for most.
  const shown = (column: string) => (row: (typeof rows)[number]) => {
    const value = sortValue(column)(row);
    if (value === null || value === undefined) return null;
    const text = String(value);
    return typeOf.get(column) === "select" || column === "status" ? `${humanise(text)} ${text}` : text;
  };
  const searchable = [
    titleColumn,
    ...resource.columns.filter((c) => c !== titleColumn),
    ...(resource.titleField && !resource.columns.includes(resource.titleField) ? [resource.titleField] : []),
  ];
  const searched = searchRows(rows, query, (row) => searchable.map((c) => shown(c)(row)));

  // Columns worth narrowing by are the ones that hold a handful of set
  // values: a status, a choice, a yes/no, or what the row belongs to. A column
  // with one value, or with more than fifteen, is not offered.
  const readChoice = (column: string) => (row: (typeof rows)[number]) => {
    const value = column === "status" && resource.past ? stage.get(String(row.id)) : row[column];
    return value === null || value === undefined || value === "" ? null : String(value);
  };
  const choiceLabel = (column: string) => (value: string) =>
    typeOf.get(column) === "reference"
      ? (labelOf.get(value) ?? "Not set")
      : value === "true"
        ? "Yes"
        : value === "false"
          ? "No"
          : humanise(value);
  const f = applyFilters(
    searched,
    search,
    resource.columns
      // The kind has its own switch above the list.
      .filter((c) => c !== kindColumn)
      .filter((c) => {
        const kind = typeOf.get(c);
        const choice = c === "status" || kind === "select" || kind === "reference" || typeof allRows[0]?.[c] === "boolean";
        const values = choice ? filterOptions(allRows, readChoice(c)).length : 0;
        return values >= 2 && values <= 15;
      })
      .map((c) => ({ key: c, name: humanise(c), read: readChoice(c), label: choiceLabel(c) })),
  );
  const ofKind = kindColumn && shownKind ? f.rows.filter((row) => row[kindColumn] === shownKind) : f.rows;
  // Public or private, for a kind whose files can be either: public is a file
  // in a public bucket, the same test the site uses to show it.
  const privacyApplies = Boolean(shownKind && resource.galleryPrivacy?.includes(shownKind));
  const isPrivate = (row: (typeof rows)[number]) => {
    const stored = resource.gallery ? row[resource.gallery] : null;
    return typeof stored === "string" && !/^(site-media|avatars)\//.test(stored);
  };
  const access =
    privacyApplies && (search.access === "public" || search.access === "private") ? search.access : undefined;
  const ofAccess = access ? ofKind.filter((row) => (access === "private") === isPrivate(row)) : ofKind;
  const carry = { q: query, sort: sortParam?.key, dir: sortParam?.dir, type: kind, access, when, ...f.active };
  // `searched` is already closest-first; a chosen sort replaces that order.
  const sorted = sortRows(ofAccess, sort, Object.fromEntries(sortable.map((c) => [c, sortValue(c)])));
  const isDate = (column: string) => typeOf.get(column) === "datetime" || /_at$/.test(column);
  const startsHigh = (column: string) => isDate(column) || typeOf.get(column) === "number";

  // The Sort menu's choices, read off the columns: the name both ways, each
  // date newest and oldest, each number both ways, and the rest A to Z.
  const sortOptions = sortable.flatMap((c) => {
    const label = heading(c);
    if (c === "created_at") {
      return [
        { label: "Newest first", key: c, dir: "desc" as const },
        { label: "Oldest first", key: c, dir: "asc" as const },
      ];
    }
    if (isDate(c)) {
      return [
        { label: `${label}: newest first`, key: c, dir: "desc" as const },
        { label: `${label}: oldest first`, key: c, dir: "asc" as const },
      ];
    }
    if (typeOf.get(c) === "number") {
      return [
        { label: `${label}: highest first`, key: c, dir: "desc" as const },
        { label: `${label}: lowest first`, key: c, dir: "asc" as const },
      ];
    }
    if (c === titleColumn) {
      return [
        { label: `${label} A to Z`, key: c, dir: "asc" as const },
        { label: `${label} Z to A`, key: c, dir: "desc" as const },
      ];
    }
    return [{ label, key: c, dir: "asc" as const }];
  });

  // Grouped under what each row belongs to, where the resource says so:
  // sessions under their series, not eight series' sessions in one run of rows.
  const groupField = resource.groupBy;
  // A tiled list shows one page of what was found; the rest is
  // a Next away. A new search, sort or filter starts again at page one.
  const pages = resource.gallery ? Math.max(1, Math.ceil(sorted.length / GALLERY_PAGE)) : 1;
  const asked = typeof search.page === "string" ? Number.parseInt(search.page, 10) : 1;
  const page = Math.min(Math.max(Number.isFinite(asked) ? asked : 1, 1), pages);
  const onPage = resource.gallery ? sorted.slice((page - 1) * GALLERY_PAGE, page * GALLERY_PAGE) : sorted;
  // This list's state (tab, search, sort, filters, page), carried into a row
  // opened from it so its Back link, save and delete come back here.
  const from = new URLSearchParams(
    Object.entries({ ...carry, page: page > 1 ? String(page) : undefined }).filter(
      (entry): entry is [string, string] => Boolean(entry[1]),
    ),
  ).toString();

  const found = groupField
    ? groupBy(onPage, (row) => String(row[groupField] ?? "")).map((g) => ({
        key: g.key,
        label: labelOf.get(g.key) ?? (g.key ? "Not set" : (resource.groupNoneLabel ?? "Not set")),
        items: g.items,
      }))
    : [];
  /*
    EVERY GROUP, EVEN AN EMPTY ONE (owner, 2026-10-14: "whether it has zero
    stuff on it so I can see it exists"). A series with no sessions yet, a
    course with no modules, a run nobody has registered for: each still gets
    its heading, with "Nothing here yet" under it. Only while the list is
    showing everything (no search or filter, the Current tab): an empty group
    under a search would only be noise.
  */
  const showEmptyGroups = Boolean(groupField) && !query && Object.keys(f.active).length === 0 && when !== "past";
  const emptyGroups =
    groupField && showEmptyGroups
      ? (references[groupField] ?? [])
          .filter((option) => !found.some((g) => g.key === option.id))
          // Under Current, not an intake or run that has already finished.
          .filter((option) => !doneParents.has(option.id))
          .map((option) => ({ key: option.id, label: option.label, items: [] as typeof rows }))
      : [];
  // A parent with no group at all (a retreat with no batch yet), shown as a
  // heading of its own with what to do, under the same conditions.
  const parentGroups =
    showEmptyGroups && resource.emptyParents
      ? bareParents.map((p) => ({ key: `parent:${p.id}`, label: p.label, items: [] as typeof rows, note: resource.emptyParents!.note }))
      : [];
  const groups: Array<{ key: string; label: string | null; items: typeof rows; note?: string }> = groupField
    ? [...found, ...emptyGroups, ...parentGroups].sort((x, y) => (x.label ?? "").localeCompare(y.label ?? ""))
    : [{ key: "all", label: null, items: onPage }];

  const empty =
    sorted.length === 0 && emptyGroups.length === 0 && parentGroups.length === 0
      ? rows.length === 0 && resource.past
        ? when === "past"
          ? "Nothing has finished yet."
          : pastCount > 0 && !resource.past.currentOnly
            ? "Nothing current. Finished ones are under Past."
            : `No ${resource.label.toLowerCase()} yet.`
        : rows.length > 0 && !query
          ? shownKind && f.rows.length > 0
            ? `No ${kindLabel(shownKind).toLowerCase()} yet.`
            : "Nothing matches. Set a filter back to Any to see more."
          : query
            ? `Nothing matches “${query}”.`
            : shownKind
              ? `No ${kindLabel(shownKind).toLowerCase()} yet.`
              : `No ${resource.label.toLowerCase()} yet.`
      : undefined;

  return (
    <>
      <AdminPageHeader
        title={resource.label}
        // Counted within what this list shows: for an area whose rows finish,
        // the current ones (or the finished ones under Past), never against
        // rows that are not on the page (owner, 2026-10-14: "34 of 40" counted
        // finished sessions that are not listed).
        meta={
          sorted.length < rows.length
            ? `${sorted.length} of ${rows.length}`
            : resource.past
              ? `${rows.length} ${when === "past" ? "finished" : "current"}`
              : `${rows.length} in total`
        }
        description={resource.description}
        actions={
          resource.createDisabled ? undefined : (
            <ButtonLink href={withFrom(`/admin/${resource.slug}/new`, from)} size="sm">
              <span aria-hidden="true">+</span> New {resource.labelSingular.toLowerCase()}
            </ButtonLink>
          )
        }
      />

      {kindColumn && kinds.length > 0 ? (
        <FilterTabs
          path={path}
          param="type"
          current={kind}
          label="Type"
          keep={{ q: query, sort: sortParam?.key, dir: sortParam?.dir, when, ...f.active }}
          options={kinds.map((k, i) => ({
            value: i === 0 ? undefined : k,
            label: kindLabel(k),
            count: f.rows.filter((row) => row[kindColumn] === k).length,
          }))}
        />
      ) : null}

      {privacyApplies ? (
        <FilterTabs
          path={path}
          param="access"
          current={access}
          label="Public or private"
          keep={{ q: query, sort: sortParam?.key, dir: sortParam?.dir, type: kind, when, ...f.active }}
          options={[
            { value: undefined, label: "All", count: ofKind.length },
            { value: "public", label: "Public", count: ofKind.filter((row) => !isPrivate(row)).length },
            { value: "private", label: "Private", count: ofKind.filter(isPrivate).length },
          ]}
        />
      ) : null}

      {resource.past && !resource.past.currentOnly ? (
        <FilterTabs
          path={path}
          param="when"
          current={when}
          label="Current or finished"
          keep={{ q: query, sort: sortParam?.key, dir: sortParam?.dir, type: kind, access, ...f.active }}
          options={[
            { value: undefined, label: "Current", count: allRows.length - pastCount },
            { value: "past", label: "Past", count: pastCount },
          ]}
        />
      ) : null}

      {allRows.length > 1 || query ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {allRows.length > 8 || query ? (
          <AdminSearch
            path={path}
            query={query}
            label={`Search ${resource.label.toLowerCase()}`}
            placeholder={`Search ${resource.label.toLowerCase()}`}
            keep={{ sort: sortParam?.key, dir: sortParam?.dir, type: kind, access, when, ...f.active }}
          />
          ) : null}
          <AdminSort
            path={`/admin/${resource.slug}`}
            state={sort}
            params={{ q: query, type: kind, access, when, ...f.active }}
            unsorted={query ? { label: "Best match" } : resource.defaultSort ? undefined : { label: "Default order" }}
            options={sortOptions}
          />
          {f.controls.map((c) => (
            <AdminFilter key={c.param} path={`/admin/${resource.slug}`} {...c} params={carry} />
          ))}
        </div>
      ) : null}

      {resource.gallery ? (
        <Gallery slug={resource.slug} from={from} marked={privacyApplies ? isPrivate : undefined} rows={onPage} pathColumn={resource.gallery} titleColumn={titleColumn} empty={empty} />
      ) : (
      <AdminTable
        headers={[
          ...resource.columns.map((c) => ({
            label: heading(c),
            key: c,
            first: startsHigh(c) ? ("desc" as const) : ("asc" as const),
          })),
          "",
        ]}
        sort={{ path, state: sort, params: { q: query, when, ...f.active } }}
        empty={empty}
        sectioned
      >
        {groups.map((group) => {
          const rows = (
            <>
            {group.items.map((row) => (
          <tr key={String(row.id)} className="hover:bg-surface-muted/60">
            {resource.columns.map((column) => (
              <td key={column} className="px-4 py-3 align-top">
                {column === titleColumn ? (
                  <Link
                    href={withFrom(`/admin/${resource.slug}/${String(row.id)}`, from)}
                    className="font-medium hover:text-accent"
                  >
                    {String(
                      (named(column)
                        ? (labelOf.get(String(row[column])) ?? (userColumns.has(column) ? row[column] : undefined))
                        : row[column]) ?? "Untitled",
                    )}
                  </Link>
                ) : userColumns.has(column) && row[column] ? (
                  // The person, linked to their own page.
                  <Link href={`/admin/users/${String(row[column])}`} className="hover:text-accent">
                    {labelOf.get(String(row[column])) ?? <Cell column={column} value={row[column]} />}
                  </Link>
                ) : (
                <Cell
                  column={column}
                  type={typeOf.get(column)}
                  value={
                    // Everything under Past has finished, whatever status it
                    // was published with, and says so in a quiet grey.
                    column === "status" && resource.past
                      ? stage.get(String(row.id))
                      : named(column)
                      ? (labelOf.get(String(row[column])) ?? row[column])
                      : row[column]
                  }
                />
                )}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <Link
                href={withFrom(`/admin/${resource.slug}/${String(row.id)}`, from)}
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
            ))}
            </>
          );
          // A grouped list is sections that fold; an ungrouped one is rows.
          return group.label !== null ? (
            <AdminGroupSection
              key={group.key}
              label={group.label}
              count={group.items.length}
              colSpan={resource.columns.length + 1}
              defaultOpen={!(when === "past" && resource.past?.foldPast)}
            >
              {group.items.length === 0 ? (
                <tr>
                  <td colSpan={resource.columns.length + 1} className="px-4 py-3 text-sm text-muted-foreground">
                    {group.note ?? "Nothing here yet."}
                  </td>
                </tr>
              ) : (
                rows
              )}
            </AdminGroupSection>
          ) : (
            <tbody key={group.key} className="divide-y divide-border">
              {rows}
            </tbody>
          );
        })}
      </AdminTable>
      )}

      {resource.gallery ? (
        <AdminPager
          path={path}
          page={page}
          pages={pages}
          from={(page - 1) * GALLERY_PAGE + 1}
          to={(page - 1) * GALLERY_PAGE + onPage.length}
          total={sorted.length}
          params={carry}
        />
      ) : null}
    </>
  );
}

/**
 * The list as thumbnails, the only way a list with a `gallery` column is
 * shown. Each tile opens the row. Only a file in a public bucket has a picture to show; anything else
 * (a recording, a link, a gated file) is a tile that says what it is.
 */
function Gallery({
  slug,
  from,
  marked,
  rows,
  pathColumn,
  titleColumn,
  empty,
}: {
  slug: string;
  from: string;
  /** Tiles to label "Private". */
  marked?: (row: Record<string, unknown>) => boolean;
  rows: Array<Record<string, unknown>>;
  pathColumn: string;
  titleColumn: string;
  empty?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-(--radius-lg) border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
      {rows.map((row) => {
        const storagePath = typeof row[pathColumn] === "string" ? (row[pathColumn] as string) : null;
        const kind = typeof row.resource_type === "string" ? row.resource_type : null;
        const src =
          storagePath && (kind === null || kind === "image") && /^(site-media|avatars)\//.test(storagePath)
            ? publicStorageUrl(storagePath)
            : null;
        const title = String(row[titleColumn] ?? "Untitled");
        return (
          <li key={String(row.id)}>
            <Link
              href={withFrom(`/admin/${slug}/${String(row.id)}`, from)}
              title={title}
              className="group relative block overflow-hidden rounded-(--radius) border border-border bg-surface transition-colors hover:border-accent"
            >
              {marked?.(row) ? (
                <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background">
                  Private
                </span>
              ) : null}
              {src ? (
                /* A plain <img>, as in the picker: a staff-only view of the
                   library, not worth an optimised copy of every file. */
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" className="aspect-square w-full bg-surface-muted object-cover" />
              ) : (
                <span className="flex aspect-square items-center justify-center bg-surface-muted p-2 text-sm text-muted-foreground">
                  {kind ? codeLabel(kind) : "No preview"}
                </span>
              )}
              <span className="block truncate px-2.5 py-2 text-xs group-hover:text-accent">{title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function humanise(column: string): string {
  return codeLabel(column);
}

function Cell({ column, type, value }: { column: string; type?: FieldType; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  if (column === "status") return <StatusPill value={String(value)} />;

  if (typeof value === "boolean") {
    return <span className="text-muted-foreground">{value ? "Yes" : "No"}</span>;
  }

  // Amounts are stored in the smallest unit, so they are rendered back into
  // pounds here rather than shown as a bare 4900.
  if (column === "amount" && typeof value === "number") {
    return <span>{(value / 100).toFixed(2)}</span>;
  }

  // A select stores a code ("group_coaching"); the list shows it as words.
  if (type === "select" && typeof value === "string") {
    return <span>{codeLabel(value)}</span>;
  }

  if (Array.isArray(value)) {
    return <span className="text-muted-foreground">{value.join(", ") || "—"}</span>;
  }

  const text = String(value);

  if (type === "datetime") {
    return (
      <span className="whitespace-nowrap text-muted-foreground">
        {new Date(text).toLocaleString("en-GB", {
          day: "numeric", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
        })}
      </span>
    );
  }

  if (/_at$/.test(column)) {
    return (
      <span className="text-muted-foreground">
        {new Date(text).toLocaleDateString("en-GB")}
      </span>
    );
  }

  // Identifiers are long and unhelpful at full length in a table.
  if (/_id$/.test(column) && text.length > 12) {
    return <span className="font-mono text-xs text-muted-foreground">{text.slice(0, 8)}…</span>;
  }

  return <span>{text}</span>;
}
