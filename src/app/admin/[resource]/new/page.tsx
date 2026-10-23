import { notFound } from "next/navigation";

import { ResourceForm } from "@/components/admin/ResourceForm";
import { AdminPageHeader } from "@/components/admin/AdminUI";
import { BackLink } from "@/components/ui/BackLink";
import { listHref } from "@/lib/admin/back";
import { listMedia, listReferences } from "@/lib/admin/crud";
import { PRODUCT_LINK_FIELD } from "@/lib/admin/product-links";
import { mediaKindsFor, resourceBySlug } from "@/lib/admin/resources";
import { requirePermission } from "@/lib/permissions";

export const metadata = { robots: { index: false } };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ type?: string; for?: string; from?: string }>;
}) {
  const { resource: slug } = await params;
  const query = await searchParams;
  const resource = resourceBySlug(slug);
  // A fixed set has no create route at all, rather than a hidden button and a
  // reachable URL.
  if (!resource || resource.createDisabled) notFound();

  // Gated on WRITE, not read: someone who may only view a list must not reach
  // the create form, even though the action would refuse them anyway.
  await requirePermission(resource.permissions.write, `/admin/${resource.slug}/new`);

  // Only the kinds this form's media fields take, and nothing at all for a
  // form without one (`listMedia` returns early).
  const media = await listMedia(mediaKindsFor(resource));

  // Same reasoning as the media library: fetched only for the resources that
  // actually have a field needing it.
  const references = await listReferences(resource, {});

  // Started from the page of what it sells (`ProductLinkPanel`): the type and
  // that choice come filled in, if it is still one the form offers.
  const linkField = slug === "products" && query.type ? PRODUCT_LINK_FIELD[query.type] : undefined;
  const preset =
    linkField && query.for && references[linkField]?.some((option) => option.id === query.for)
      ? { product_type: query.type, [linkField]: query.for }
      : undefined;

  return (
    <>
      <BackLink href={listHref(resource.slug, query.from)}>All {resource.label.toLowerCase()}</BackLink>
      <AdminPageHeader title={`New ${resource.labelSingular.toLowerCase()}`} description={resource.description} />
      <ResourceForm resource={resource} media={media} references={references} row={preset} from={query.from} />
    </>
  );
}
