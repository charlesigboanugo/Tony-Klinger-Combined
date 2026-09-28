import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { AdminPageHeader, AdminSearch } from "@/components/admin/AdminUI";
import { ButtonLink } from "@/components/ui/Button";
import { listReferences, listRows } from "@/lib/admin/crud";
import { resourceBySlug, type FieldType } from "@/lib/admin/resources";
import { requirePermission } from "@/lib/permissions";

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
  const { q } = await searchParams;
  const query = typeof q === "string" && q.trim() ? q.trim() : undefined;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  await requirePermission(resource.permissions.read, `/admin/${resource.slug}`);
  const [allRows, references] = await Promise.all([listRows(resource), listReferences(resource)]);

  // Search runs over the text shown in the list — the title and every listed
  // text column — so what you can see is what you can find.
  const needle = query?.toLowerCase();
  const rows = needle
    ? allRows.filter((row) =>
        [resource.titleField, ...resource.columns]
          .filter(Boolean)
          .some((c) => String(row[c as string] ?? "").toLowerCase().includes(needle)),
      )
    : allRows;
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

  return (
    <>
      <AdminPageHeader
        title={resource.label}
        meta={query ? `${rows.length} of ${allRows.length}` : `${allRows.length} in total`}
        description={resource.description}
        actions={
          resource.createDisabled ? undefined : (
            <ButtonLink href={`/admin/${resource.slug}/new`} size="sm">
              <span aria-hidden="true">+</span> New {resource.labelSingular.toLowerCase()}
            </ButtonLink>
          )
        }
      />

      {allRows.length > 8 || query ? (
        <div className="mb-5">
          <AdminSearch
            path={`/admin/${resource.slug}`}
            query={query}
            label={`Search ${resource.label.toLowerCase()}`}
            placeholder={`Search ${resource.label.toLowerCase()}`}
          />
        </div>
      ) : null}

      <AdminTable
        headers={[...resource.columns.map(humanise), ""]}
        empty={
          rows.length === 0
            ? query
              ? `Nothing matches “${query}”.`
              : `No ${resource.label.toLowerCase()} yet.`
            : undefined
        }
      >
        {rows.map((row) => (
          <tr key={String(row.id)} className="hover:bg-surface-muted/60">
            {resource.columns.map((column) => (
              <td key={column} className="px-4 py-3 align-top">
                {column === titleColumn ? (
                  <Link
                    href={`/admin/${resource.slug}/${String(row.id)}`}
                    className="font-medium hover:text-accent"
                  >
                    {String(
                      (typeOf.get(column) === "reference"
                        ? labelOf.get(String(row[column]))
                        : row[column]) ?? "Untitled",
                    )}
                  </Link>
                ) : (
                <Cell
                  column={column}
                  type={typeOf.get(column)}
                  value={
                    typeOf.get(column) === "reference"
                      ? (labelOf.get(String(row[column])) ?? row[column])
                      : row[column]
                  }
                />
                )}
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/${resource.slug}/${String(row.id)}`}
                className="text-sm font-medium text-accent underline-offset-4 hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}

function humanise(column: string): string {
  return column.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
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
    return <span>{value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}</span>;
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
