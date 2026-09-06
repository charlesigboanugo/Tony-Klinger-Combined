import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/admin/ResourceForm";
import { PageHeader } from "@/components/layout/PageHeader";
import { listMedia, listReferences } from "@/lib/admin/crud";
import { resourceBySlug } from "@/lib/admin/resources";
import { requirePermission } from "@/lib/permissions";

export const metadata = { robots: { index: false } };

export default async function Page({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource: slug } = await params;
  const resource = resourceBySlug(slug);
  // A fixed set has no create route at all, rather than a hidden button and a
  // reachable URL.
  if (!resource || resource.createDisabled) notFound();

  // Gated on WRITE, not read: someone who may only view a list must not reach
  // the create form, even though the action would refuse them anyway.
  await requirePermission(resource.permissions.write, `/admin/${resource.slug}/new`);

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
      <PageHeader
        title={`New ${resource.labelSingular.toLowerCase()}`}
        description={resource.description}
      />
      <ResourceForm resource={resource} media={media} references={references} />
    </>
  );
}
