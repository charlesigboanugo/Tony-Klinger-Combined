import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExternalMark } from "@/components/navigation/ExternalMark";
import { Reveal } from "@/components/motion/Reveal";
import { StoredImage } from "@/components/media/StoredImage";
import { listCatalogueByTag } from "@/lib/content/catalogue";
import {
  GIVE_GET_GO_EDUCATION_URL,
  GIVE_GET_GO_SECTIONS,
} from "@/lib/content/give-get-go";
import { cn } from "@/lib/utils/cn";

const TONES = ["oxblood", "teal", "indigo"] as const;
const TONE_CLASS = {
  oxblood: "bg-block-oxblood",
  teal: "bg-block-teal",
  indigo: "bg-block-indigo",
} as const;

export const metadata: Metadata = {
  title: "Give-Get-Go",
  description:
    "Tony Klinger's broader venture — publishing, films and documentaries — and the related Give-Get-Go Education CIC.",
};

/**
 * Give-Get-Go overview — note 11.
 *
 * Context, not a second platform. The note is explicit that this "should
 * provide context rather than attempting to recreate a separate Give-Get-Go
 * platform", so this page introduces the areas of activity and hands off to the
 * existing catalogue content rather than restating it.
 */
export default async function GiveGetGoPage() {
  /*
    Each section is a TAG-FILTERED VIEW over `catalogue_items` (note 08
    §28.2.1), so the overview can show the actual work rather than describing
    it — three real covers per section, drawn from the same rows the section
    page lists. Nothing is duplicated: these are previews of existing items.
  */
  const previews = await Promise.all(
    GIVE_GET_GO_SECTIONS.map(async (section) => ({
      slug: section.slug,
      items: (await listCatalogueByTag(section.tag)).slice(0, 3),
    })),
  );
  const previewFor = (slug: string) =>
    previews.find((p) => p.slug === slug)?.items ?? [];
  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="The wider venture"
          title="Give-Get-Go"
          description="Tony Klinger's broader venture — the publishing, film and documentary work that sits alongside the coaching practice."
        />

        <div className="max-w-2xl space-y-4 text-muted-foreground">
          <p>
            Give-Get-Go brings together the work Tony makes rather than teaches:
            books published under the Give-Get-Go Books imprint, feature films,
            and documentary projects.
          </p>
          <p>
            Everything here is part of this site. The one exception is
            Give-Get-Go Education, a separate community interest company with its
            own website and platform.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {GIVE_GET_GO_SECTIONS.map((section, i) => {
            const items = previewFor(section.slug);
            const tone = TONES[i % TONES.length];

            return (
              <Reveal as="li" key={section.slug} delay={(i % 3) * 70} className="h-full">
                <Link
                  href={`/give-get-go/${section.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-card transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-1 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none"
                >
                  {/* A strip of the section's actual covers. Falls back to a
                      solid jewel field where a section has none yet, so the
                      grid never shows an empty frame. */}
                  <div className={cn("grain relative flex h-32 gap-1 p-2", TONE_CLASS[tone])}>
                    {items.length > 0 ? (
                      items.map((item) => (
                        <div
                          key={item.id}
                          className="relative flex-1 overflow-hidden rounded-sm bg-black/20"
                        >
                          {item.storage_path ? (
                            <StoredImage
                              path={item.storage_path}
                              alt=""
                              fill
                              fit="contain"
                              sizes="120px"
                              className="p-1"
                            />
                          ) : null}
                        </div>
                      ))
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <h2 className="font-display text-lg font-semibold group-hover:text-primary">
                      {section.label}
                    </h2>
                    <p className="mt-2 flex-1 text-sm text-muted-foreground">
                      {section.description}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {items.length > 0
                        ? `${items.length === 3 ? "3+" : items.length} ${items.length === 1 ? "work" : "works"}`
                        : "Being curated"}
                    </p>
                  </div>
                </Link>
              </Reveal>
            );
          })}

          {/* Presented as a related venture, deliberately distinct from the
              cards above: it is the only destination that leaves this site, and
              it is not part of the Academy (note 11). */}
          <li>
            <a
              href={GIVE_GET_GO_EDUCATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-(--radius) border border-dashed border-border bg-surface-muted/40 p-6 transition-colors hover:border-accent"
            >
              <h2 className="flex items-center gap-2 text-lg font-medium group-hover:text-accent">
                Give-Get-Go Education
                <ExternalMark />
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                A related education venture — Give-Get-Go Education CIC — with
                its own independent website and platform.
              </p>
              <span className="mt-4 text-sm text-muted-foreground underline underline-offset-4">
                give-get-go.com
              </span>
            </a>
          </li>
        </ul>
      </Container>
    </Section>
  );
}
