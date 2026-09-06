import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { listRows } from "@/lib/admin/crud";
import { resourceBySlug } from "@/lib/admin/resources";
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
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource: slug } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  await requirePermission(resource.permissions.read, `/admin/${resource.slug}`);
  const rows = await listRows(resource);

  return (
    <>
      <PageHeader
        title={resource.label}
        description={resource.description}
        actions={
          resource.createDisabled ? undefined : (
            <ButtonLink href={`/admin/${resource.slug}/new`} size="sm">
              New {resource.labelSingular.toLowerCase()}
            </ButtonLink>
          )
        }
      />

      <AdminTable
        headers={[...resource.columns.map(humanise), ""]}
        empty={rows.length === 0 ? `No ${resource.label.toLowerCase()} yet.` : undefined}
      >
        {rows.map((row) => (
          <tr key={String(row.id)} className="hover:bg-surface">
            {resource.columns.map((column) => (
              <td key={column} className="px-4 py-3 align-top">
                <Cell column={column} value={row[column]} />
              </td>
            ))}
            <td className="px-4 py-3 text-right">
              <Link
                href={`/admin/${resource.slug}/${String(row.id)}`}
                className="text-sm underline underline-offset-4 hover:text-accent"
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

function Cell({ column, value }: { column: string; value: unknown }) {
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

  if (Array.isArray(value)) {
    return <span className="text-muted-foreground">{value.join(", ") || "—"}</span>;
  }

  const text = String(value);

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
