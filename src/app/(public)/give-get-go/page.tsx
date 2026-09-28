import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Band, BandHeader } from "@/components/layout/Band";
import { Container } from "@/components/layout/Container";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { StoredImage } from "@/components/media/StoredImage";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { ExternalMark } from "@/components/navigation/ExternalMark";
import {
  WorkAccordion,
  type AccordionPanel,
} from "@/components/content/WorkAccordion";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import {
  COVER_FOCUS_CLASS,
  categoryLabel,
  workHref,
  type CatalogueItem,
} from "@/lib/content/catalogue";
import {
  GIVE_GET_GO_EDUCATION_URL,
  listGiveGetGo,
  type GiveGetGoShelf,
} from "@/lib/content/give-get-go";
import { designPhotos } from "@/lib/site/design-photos";
import { cn } from "@/lib/utils/cn";
import { Eyebrow } from "@/components/ui/Eyebrow";

export const metadata: Metadata = {
  title: "Give-Get-Go",
  description:
    "Tony Klinger's broader venture — publishing, films and documentaries — and the related Give-Get-Go Education CIC.",
  alternates: { canonical: "/give-get-go" },
};

const beat = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

/**
 * Give-Get-Go — note 11.
 *
 * ONE PAGE, THEN THE WAY OUT (owner, 2026-09-25). Publishing, Films and
 * Documentaries used to be an overview plus three thin pages; they are now
 * sections of this one, reached by anchor, and the page ends by handing the
 * visitor to the independent Give-Get-Go Education website. The old section
 * URLs redirect here (next.config.ts).
 *
 * Still context, not a second platform: every work shown is an existing
 * `catalogue_items` row selected by its curation tag (note 08 §28.2.1), and
 * each links to its one canonical page in the catalogue.
 *
 * Rhythm: full-bleed photo hero, Publishing on the paper tone, Films in the
 * noir screening room, Documentaries on the page ground, Education as a
 * closing letterbox on noir.
 */
export default async function GiveGetGoPage() {
  const shelves = (await listGiveGetGo()).filter(
    (shelf) => shelf.items.length > 0,
  );
  const shelf = (slug: string) => shelves.find((s) => s.slug === slug);

  const publishing = shelf("publishing");
  const films = shelf("films");
  const documentaries = shelf("documentaries");

  return (
    <>
      <Hero shelves={shelves} />

      {publishing ? (
        <section
          id={publishing.slug}
          aria-labelledby="publishing-heading"
          className="scroll-mt-20 overflow-x-clip bg-surface-muted py-16 sm:py-24"
        >
          <Container>
            <ShelfHeader
              shelf={publishing}
              eyebrow="Give-Get-Go Books"
              allLabel="All of Tony's books"
            />
            <Rail items={publishing.items} label="Publishing" />
          </Container>
        </section>
      ) : null}

      {films ? (
        <div id={films.slug} className="scroll-mt-20">
          <Band>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <BandHeader
                eyebrow="On screen"
                title={films.label}
                lead={films.description}
              />
              <AllLink
                href={films.catalogueHref}
                label="All of Tony's films"
                onBlock
              />
            </div>
            <Rail items={films.items} label="Films" />
          </Band>
        </div>
      ) : null}

      {documentaries ? (
        <section
          id={documentaries.slug}
          aria-labelledby="documentaries-heading"
          className="scroll-mt-20 overflow-x-clip py-16 sm:py-24"
        >
          <Container>
            <ShelfHeader shelf={documentaries} eyebrow="True stories" />
            <Rail items={documentaries.items} label="Documentaries" />
          </Container>
        </section>
      ) : null}

      <Education />
    </>
  );
}

/**
 * Full bleed: the portrait fills the field and the words sit over its empty
 * yellow half — no split, no card. On phones the photo takes the top of the
 * field and fades into the noir the words are set on, so a face is never
 * printed over.
 *
 * The title's three words rise one after another, the name read as what it
 * is: three verbs.
 */
function Hero({ shelves }: { shelves: GiveGetGoShelf[] }) {
  const photo = designPhotos.giveGetGo;
  const words = ["Give-", "Get-", "Go"];

  return (
    <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground">
      {/* THE WHOLE FRAME, NOT A CROP. Covering the field cut the photo to
          the hero's shape, taking the top of the head and the hand. Instead
          the photo keeps its own 3:2 ratio: full width on phones, and from lg
          the full hero height, anchored right, its left edge dissolving into
          the noir the words sit on. Still a background — only it is no longer
          zoomed in. */}
      <figure
        className={cn(
          "absolute inset-x-0 top-0 -z-10 aspect-3/2 w-full",
          "mask-[linear-gradient(to_bottom,black_60%,transparent)]",
          "lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-auto lg:max-w-[88%]",
          "lg:mask-[linear-gradient(to_right,transparent,black_45%),linear-gradient(to_bottom,black_75%,transparent)] lg:mask-intersect",
        )}
      >
        <div className="absolute inset-0 animate-[fade-in_1.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            quality={90}
            sizes="(min-width: 1024px) 88vw, 100vw"
            className="object-cover object-[70%_top]"
          />
        </div>
      </figure>

      <Container className="relative flex min-h-[calc(100svh-4rem)] flex-col pt-[calc(66.7vw-3rem)] pb-10 lg:min-h-[min(calc(100svh-4.5rem),56rem)] lg:pt-(--hero-text-top) lg:pb-14">
        <div className="my-auto py-8 lg:my-0 lg:max-w-[52%] lg:py-0">
          <p
            className="flex items-center gap-4 text-xs font-semibold tracking-[0.2em] text-block-foreground/75 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(80)}
          >
            <span
              aria-hidden="true"
              className="h-px w-10 bg-block-foreground/50"
            />
            The wider venture
          </p>

          <h1 className="mt-6 flex whitespace-nowrap">
            {words.map((word, i) => (
              // Padding below and a matching negative margin give descenders
              // room inside the clipping mask each word rises out of.
              // The italic last word overhangs its box, so it gets room on the
              // right too.
              <span
                key={word}
                className={cn(
                  "mb-[-0.1em] block overflow-hidden pb-[0.1em]",
                  i === words.length - 1 && "pr-[0.12em]",
                )}
              >
                <span
                  className={cn(
                    "block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none",
                    i === words.length - 1 &&
                      "font-normal text-[color-mix(in_oklab,var(--block-foreground)_70%,var(--block-oxblood))] italic",
                  )}
                  style={beat(160 + i * 140)}
                >
                  {word}
                </span>
              </span>
            ))}
          </h1>

          <p
            className="mt-7 max-w-124 text-lg leading-relaxed text-block-foreground/85 text-pretty animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(640)}
          >
            The work Tony makes rather than teaches: books under the Give-Get-Go
            Books imprint, feature films and documentaries — and, alongside
            them, Give-Get-Go Education, opening filmmaking up to people who
            would not otherwise get near it.
          </p>
        </div>

        {/* The page's own contents, set like the billing block at the foot of
            a poster: each section by name, the last one leaving the site. */}
        <nav
          aria-label="On this page"
          className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-block-foreground/20 pt-6 animate-[fade-up_1s_var(--ease-out-expo)_both] motion-reduce:animate-none lg:mt-auto lg:grid-cols-4"
          style={beat(820)}
        >
          {shelves.map((s) => (
            <IndexLink
              key={s.slug}
              href={`#${s.slug}`}
              label={s.label}
              note={s.description}
            />
          ))}
          <IndexLink
            href={GIVE_GET_GO_EDUCATION_URL}
            label="Education"
            note="Give-Get-Go Education CIC, on its own website."
            external
          />
        </nav>

        <PhotoCredit src={photo.src} variant="overlay" />
      </Container>
    </section>
  );
}

function IndexLink({
  href,
  label,
  note,
  external = false,
}: {
  href: string;
  label: string;
  note: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group block outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex items-center gap-2 font-display text-xl font-semibold transition-colors duration-(--dur-fast) group-hover:text-accent sm:text-2xl">
        {label}
        {external ? (
          <ExternalMark className="h-3.5 w-3.5 shrink-0 opacity-80" />
        ) : null}
      </span>
      <span className="mt-1.5 hidden text-sm leading-snug text-block-foreground/70 sm:block">
        {note}
      </span>
    </a>
  );
}

function ShelfHeader({
  shelf,
  eyebrow,
  allLabel,
}: {
  shelf: GiveGetGoShelf;
  eyebrow: string;
  allLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <Reveal className="max-w-3xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2
          id={`${shelf.slug}-heading`}
          className="mt-3 font-display text-balance"
        >
          {shelf.label}
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">
          {shelf.description}
        </p>
      </Reveal>
      {allLabel ? (
        <AllLink href={shelf.catalogueHref} label={allLabel} />
      ) : null}
    </div>
  );
}

/** The unfiltered collection a curated section is drawn from. */
function AllLink({
  href,
  label,
  onBlock = false,
}: {
  href?: string;
  label: string;
  onBlock?: boolean;
}) {
  if (!href) return null;
  return (
    <Link
      href={href}
      className={cn(
        "group/btn inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:text-accent hover:underline",
        onBlock ? "text-block-foreground" : "text-primary",
      )}
    >
      {label}
      <ButtonArrow />
    </Link>
  );
}

/**
 * A section's works as a WorkAccordion: one close-set block of panels, one
 * always open. The data is prepared here because the catalogue helpers are
 * server-only; the cover is rendered here and handed through as a node.
 */
function Rail({ items, label }: { items: CatalogueItem[]; label: string }) {
  const panels: AccordionPanel[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    kicker: kickerFor(item),
    description: item.description,
    link: workHref(item),
    media: item.storage_path ? (
      <StoredImage
        path={item.storage_path}
        alt=""
        fill
        quality={90}
        sizes="(min-width: 1024px) 34vw, (min-width: 640px) 42vw, 74vw"
        className={COVER_FOCUS_CLASS[item.cover_focus]}
      />
    ) : (
      <GeneratedCover
        title={item.title}
        seed={item.slug}
        showTitle={false}
        eyebrow={categoryLabel(item.category)}
      />
    ),
  }));

  return (
    <Reveal className="mt-12">
      <WorkAccordion panels={panels} label={label} />
    </Reveal>
  );
}

/** The format line over a panel's title. A documentary is a film by
 *  category, so its curation tag names it more precisely. */
function kickerFor(item: CatalogueItem): string {
  if (item.tags.includes("give-get-go:documentaries")) return "Documentary";
  if (item.category === "books") return "Book";
  if (item.category === "films") return "Film";
  return categoryLabel(item.category);
}

/**
 * The hand-off. Give-Get-Go Education CIC is a related venture with its own
 * independent website (note 11), so the page closes by sending the visitor
 * there — clearly marked as leaving — rather than presenting it as a section
 * of this site or of the Academy.
 *
 * A LETTERBOX, NOT A BANNER. The portrait is cropped to a widescreen strip
 * across the eyes and fades into the noir at both edges; the words sit
 * centred beneath it on the field. Set over the photo instead, white type
 * landed on a pale backdrop and across the face.
 */
function Education() {
  const photo = designPhotos.giveGetGoBanner;

  return (
    <section
      id="education"
      aria-labelledby="education-heading"
      className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground"
    >
      <figure className="relative h-[clamp(13rem,34vw,28rem)] mask-[linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)]">
        <Parallax
          speed={0.06}
          className="absolute inset-x-0 top-[-8%] h-[116%]"
        >
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            quality={90}
            sizes="100vw"
            className="object-cover object-[50%_36%]"
          />
        </Parallax>
      </figure>

      <Container className="relative pt-6 pb-20 text-center sm:pb-28">
        <Reveal className="mx-auto max-w-3xl">
          <p className="flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.2em] text-block-foreground/70 uppercase">
            <span
              aria-hidden="true"
              className="h-px w-10 bg-block-foreground/40"
            />
            A related venture
            <span
              aria-hidden="true"
              className="h-px w-10 bg-block-foreground/40"
            />
          </p>
          <h2 id="education-heading" className="mt-4 font-display text-balance">
            Give-Get-Go Education
          </h2>
          <p className="measure mx-auto mt-5 text-lg leading-relaxed text-block-foreground/85 text-pretty">
            Filmmaking, opened up to people who would not otherwise get near it.
            Give-Get-Go Education is a community interest company with its own
            website and platform.
          </p>
          <ButtonLink
            href={GIVE_GET_GO_EDUCATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            className="mt-9"
          >
            Visit give-get-go.com
            <ExternalMark className="h-3.5 w-3.5 shrink-0" />
          </ButtonLink>
        </Reveal>
      </Container>

      <PhotoCredit src={photo.src} variant="overlay" />
    </section>
  );
}
