import { notFound } from "next/navigation";

import { deleteResourceAction } from "@/app/admin/actions";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getRow, listMedia, listReferences } from "@/lib/admin/crud";
import { resourceBySlug } from "@/lib/admin/resources";
import { can, requirePermission } from "@/lib/permissions";

export const metadata = { robots: { index: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ resource: string; id: string }>;
}) {
  const { resource: slug, id } = await params;
  const resource = resourceBySlug(slug);
  if (!resource) notFound();

  const context = await requirePermission(
    resource.permissions.write,
    `/admin/${resource.slug}/${id}`,
  );

  const row = await getRow(resource, id);
  if (!row) notFound();

  const title = resource.titleField ? String(row[resource.titleField] ?? id) : id;

  // Deletion is shown only to someone who holds the permission. It is checked
  // again in the action — this hides a control they cannot use, it does not
  // enforce anything (note 06 §24).
  const mayDelete = can(context, resource.permissions.remove ?? resource.permissions.write);

  // Fetched only when the form needs it: most resources have no media field,
  // and loading the library for them is a query for nothing.
  const media = resource.fields.some((f) => f.type === "media")
    ? await listMedia()
    : [];

  // Same reasoning as the media library: fetched only for the resources that
  // actually have a field needing it.
  const references = await listReferences(resource);

  return (
    <>
      <BackLink href={`/admin/${resource.slug}`}>All {resource.label.toLowerCase()}</BackLink>
      <AdminPageHeader title={title} description={`Editing this ${resource.labelSingular.toLowerCase()}.`} />

      <ResourceForm resource={resource} row={row} media={media} references={references} />

      {mayDelete ? (
        <div className="mt-12 max-w-2xl rounded-(--radius) border border-error/40 p-5">
          <h2 className="text-sm font-medium">Delete</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent. The database will refuse if orders, entitlements or
            bookings still reference this.
          </p>
          <form action={deleteResourceAction} className="mt-4">
            <input type="hidden" name="__resource" value={resource.slug} />
            <input type="hidden" name="__id" value={id} />
            <SubmitButton variant="destructive" pendingLabel="Deleting…">
              Delete {resource.labelSingular.toLowerCase()}
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </>
  );
}
