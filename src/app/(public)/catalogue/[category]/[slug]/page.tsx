import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import {
  categoryLabel,
  getCatalogueItem,
  isCatalogueCategory,
} from "@/lib/content/catalogue";

export async function generateMetadata({
  params,
}: PageProps<"/catalogue/[category]/[slug]">): Promise<Metadata> {
  const { category, slug } = await params;
  const item = await getCatalogueItem(category, slug);
  return item
    ? { title: item.title, description: item.description ?? undefined }
    : { title: "Not found" };
}

export default async function CatalogueItemPage({
  params,
}: PageProps<"/catalogue/[category]/[slug]">) {
  const { category, slug } = await params;
  if (!isCatalogueCategory(category)) notFound();

  const item = await getCatalogueItem(category, slug);
  if (!item) notFound();

  // An external work has no internal page to render — send the reader to it
  // rather than showing a stub (note 03 §36).
  if (item.is_external && item.external_url) redirect(item.external_url);

  return (
    <Section>
      <Container width="narrow">
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
          <Link href="/catalogue" className="hover:text-foreground">Catalogue</Link>
          <span aria-hidden="true"> / </span>
          <Link href={`/catalogue/${category}`} className="hover:text-foreground">
            {categoryLabel(category)}
          </Link>
        </nav>

        <article className="space-y-6">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {item.title}
          </h1>
          {item.description ? (
            <p className="text-lg text-muted-foreground text-pretty">
              {item.description}
            </p>
          ) : null}
          {item.body ? (
            <div className="space-y-4 leading-relaxed">
              {item.body.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}
        </article>
      </Container>
    </Section>
  );
}
