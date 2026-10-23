import { notFound } from "next/navigation";

import { deleteResourceAction } from "@/app/admin/actions";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { ProductLinkPanel } from "@/components/admin/ProductLinkPanel";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { listHref } from "@/lib/admin/back";
import { getRow, listMedia, listReferences } from "@/lib/admin/crud";
import { isUserColumn, peopleByIds } from "@/lib/admin/operations";
import { linkedProducts } from "@/lib/admin/product-links";
import { isPast, mediaKindsFor, resourceBySlug } from "@/lib/admin/resources";
import { can, requirePermission } from "@/lib/permissions";

export const metadata = { robots: { index: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string; id: string }>;
  searchParams: Promise<{ deleteError?: string; from?: string }>;
}) {
  const { resource: slug, id } = await params;
  // Why a delete was refused, sent back by the delete action.
  // The list this was opened from, to go back to (`back.ts`).
  const { deleteError, from } = await searchParams;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  const context = await requirePermission(
    resource.permissions.write,
    `/admin/${resource.slug}/${id}`,
  );

  const row = await getRow(resource, id);
  if (!row) notFound();

  // The emails of the accounts this row names, for the title and the form:
  // staff see who it is, not a uuid (owner, 2026-10-13).
  const people = await peopleByIds(
    resource.fields.filter((f) => isUserColumn(f.name)).map((f) => (row[f.name] ? String(row[f.name]) : null)),
  );
  const emails = Object.fromEntries(
    [...people].flatMap(([userId, person]) => (person.email ? [[userId, person.email] as const] : [])),
  );

  const rawTitle = resource.titleField ? String(row[resource.titleField] ?? id) : id;
  const title = emails[rawTitle] ?? rawTitle;

  // Deletion is shown only to someone who holds the permission. It is checked
  // again in the action — this hides a control they cannot use, it does not
  // enforce anything (note 06 §24).
  // A finished row is a record: read-only, apart from what is meant to change
  // afterwards (`past.stillEditable`), and never deleted. The save and the
  // delete refuse it too; this only stops offering them.
  const finished = isPast(resource, row);
  // A Media item's delete also removes its file (crud.ts, `deleteRow`).
  const isMedia = resource.table === "resources";
  // Deleting a lesson takes learners' progress with it; Archived keeps both.
  const isLesson = resource.table === "lessons";
  const mayDelete = !finished && can(context, resource.permissions.remove ?? resource.permissions.write);

  // Only the kinds this form's media fields take, and nothing at all for a
  // form without one (`listMedia` returns early).
  const media = await listMedia(mediaKindsFor(resource));

  // Same reasoning as the media library: fetched only for the resources that
  // actually have a field needing it.
  const references = await listReferences(resource, { rowId: id });

  // The product(s) this is sold by, for the things a product sells.
  const linked = await linkedProducts(resource.table, row);

  return (
    <>
      <BackLink href={listHref(resource.slug, from)}>All {resource.label.toLowerCase()}</BackLink>
      <AdminPageHeader
        title={title}
        description={finished ? undefined : `Editing this ${resource.labelSingular.toLowerCase()}.`}
      />

      {finished ? (
        <p role="status" className="mb-6 max-w-4xl rounded-(--radius) border border-border bg-surface-muted px-4 py-3 text-sm">
          <span className="font-medium">This {resource.labelSingular.toLowerCase()} has finished</span>, so it is kept
          as a record and can no longer be changed
          {resource.past?.stillEditable?.length ? ", apart from adding or changing its recording" : ""}.
        </p>
      ) : null}

      <ResourceForm
        resource={resource}
        row={row}
        media={media}
        references={references}
        emails={emails}
        finished={finished}
        from={from}
      />

      {linked ? (
        <ProductLinkPanel
          linked={linked}
          rowId={id}
          noun={resource.labelSingular.toLowerCase()}
          mayCreate={can(context, "products.update")}
        />
      ) : null}

      {mayDelete && deleteError ? (
        <p role="alert" className="mt-8 max-w-4xl rounded-(--radius) border border-error bg-error/10 px-4 py-3 text-sm text-error">
          <span className="font-medium">Not deleted.</span> {deleteError}
        </p>
      ) : null}

      {mayDelete ? (
        <div className="mt-8 flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-(--radius-lg) border border-error/40 bg-surface p-5 shadow-card sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Delete this {resource.labelSingular.toLowerCase()}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isMedia
                ? "Permanent. Its file is deleted from storage too. Refused while it is still used anywhere on the site."
                : isLesson
                  ? "Permanent. Learners' progress on this lesson is deleted with it. To take it off the course but keep that progress, set its status to Archived instead."
                  : "Permanent. The database will refuse if orders, entitlements or bookings still reference this."}
            </p>
          </div>
          <form action={deleteResourceAction} className="shrink-0">
            <input type="hidden" name="__resource" value={resource.slug} />
            <input type="hidden" name="__id" value={id} />
            {from ? <input type="hidden" name="__from" value={from} /> : null}
            <ConfirmSubmit
              variant="destructive"
              destructive
              pendingLabel="Deleting…"
              title={`Delete this ${resource.labelSingular.toLowerCase()}?`}
              points={
                isMedia
                  ? [
                      "It is removed from admin, and its file is deleted from storage.",
                      "If it is still used anywhere on the site, it is not deleted, and you are told where.",
                    ]
                  : isLesson
                    ? [
                        "It is removed from the course and from admin.",
                        "Every learner's progress on it is deleted too, so their course progress changes.",
                        "To hide it but keep that progress, cancel and set its status to Archived.",
                      ]
                    : [
                      "It is removed from the site and from admin.",
                      "The database will refuse if orders, entitlements or bookings still depend on it, and nothing will change.",
                    ]
              }
              note="This is permanent. It cannot be undone."
              confirmLabel="Yes, delete it"
              cancelLabel="Keep it"
            >
              Delete {resource.labelSingular.toLowerCase()}
            </ConfirmSubmit>
          </form>
        </div>
      ) : null}
    </>
  );
}
