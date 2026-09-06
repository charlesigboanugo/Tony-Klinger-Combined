import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import { StoredImage } from "@/components/media/StoredImage";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { categoryLabel } from "@/lib/content/catalogue";
import {
  GIVE_GET_GO_SECTIONS,
  giveGetGoSection,
  listSectionItems,
} from "@/lib/content/give-get-go";

/**
 * Give-Get-Go section — note 11.
 *
 * One dynamic route for Publishing, Films and Documentaries rather than three
 * near-identical pages: they differ only in which catalogue categories they
 * present, and that difference is data (note 03 §35).
 *
 * NOTHING IS DUPLICATED. Each section is a view over existing
 * `catalogue_items`, so a work published once appears in both its catalogue
 * category and here, and is edited in one place.
 */
export function generateStaticParams() {
  return GIVE_GET_GO_SECTIONS.map((section) => ({ section: section.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section: slug } = await params;
  const section = giveGetGoSection(slug);

  if (!section) return { title: "Not found" };

  return {
    title: `${section.label} — Give-Get-Go`,
    description: section.description,
  };
}

export default async function GiveGetGoSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section: slug } = await params;
  const section = giveGetGoSection(slug);

  if (!section) notFound();

  const items = await listSectionItems(section);

  return (
    <Section>
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link
            href="/give-get-go"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Give-Get-Go
          </Link>
          <span className="mx-2 text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-foreground">{section.label}</span>
        </nav>

        <PageHeader
          title={section.label}
          description={section.description}
          actions={
            section.catalogueHref ? (
              /* A section is a curated subset, so this offers the unfiltered
                 collection it is drawn from — for Documentaries that is the
                 films, since a documentary is a film (note 08 §28.2.1). */
              <ButtonLink href={section.catalogueHref} variant="outline" size="sm">
                Browse the full catalogue
              </ButtonLink>
            ) : undefined
          }
        />

        {items.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/catalogue/${item.category}/${item.slug}`}
                  className="group flex h-full flex-col rounded-(--radius) border border-border bg-surface p-6 transition-colors hover:border-accent"
                >
                  {item.storage_path ? (
                    <StoredImage
                      path={item.storage_path}
                      alt=""
                      width={480}
                      height={640}
                      sizes="(min-width: 1024px) 20vw, 45vw"
                      className="mb-4 aspect-[3/4] w-full rounded-(--radius) border border-border object-cover"
                    />
                  ) : null}
                  <h2 className="text-lg font-medium group-hover:text-accent">
                    {item.title}
                  </h2>
                  {item.description ? (
                    <p className="mt-3 flex-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                  <span className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">
                    {categoryLabel(item.category)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          /* Empty means nothing carries this section's curation tag yet — an
             editorial state, not a missing feature (note 08 §28.2.1). The
             onward link goes to the wider catalogue so the page is never a
             dead end. */
          <EmptyState
            title={`No ${section.label.toLowerCase()} listed yet`}
            description="Nothing has been added to this section so far. It will appear here as soon as it is."
            action={
              <ButtonLink
                href={section.catalogueHref ?? "/catalogue"}
                variant="outline"
              >
                Browse the catalogue
              </ButtonLink>
            }
          />
        )}
      </Container>
    </Section>
  );
}
