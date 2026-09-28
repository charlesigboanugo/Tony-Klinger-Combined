import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScreeningHero } from "@/components/catalogue/ScreeningHero";
import { Container } from "@/components/layout/Container";
import { AudioPlayer } from "@/components/media/AudioPlayer";
import { StoredImage } from "@/components/media/StoredImage";
import { ButtonLink } from "@/components/ui/Button";
import {
  COVER_FOCUS_CLASS,
  categoryLabel,
  coverShape,
  getCatalogueItem,
  getCatalogueItemExtras,
  hasOwnPage,
  isCatalogueCategory,
  listCatalogue,
  workHref,
  type CatalogueItem,
} from "@/lib/content/catalogue";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/catalogue/[category]/[slug]">): Promise<Metadata> {
  const { category, slug } = await params;
  const item = await getCatalogueItem(category, slug);
  return item
    ? { title: item.title, description: item.description ?? undefined }
    : { title: "Not found" };
}

/**
 * One work — note 03 §8, note 10 §42.
 *
 * A ONE-SHEET, then a reading room. The page opens on the same premiere stage
 * as its collection (`ScreeningHero`): the work's own artwork blurred into
 * light, the title, line, player and links centred, and the artwork itself —
 * whole, at its own ratio — lowered beneath them over the stage's edge. No
 * poster-beside-title split (owner, 2026-09-25). Below, an editorial
 * column: a lede, the text, section headings in the display face. Further
 * images run as a filmstrip, and the foot of the page leads on to the
 * neighbouring works in the same collection, so a reader moves through the
 * slate rather than back out to a list.
 */
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

  // No body copy, no page: everything the work has is already on its card.
  // A 404 rather than a stub, so an old or guessed URL is not an empty page.
  if (!hasOwnPage(item)) notFound();

  const [{ gallery, audio, links }, siblings] = await Promise.all([
    getCatalogueItemExtras(item.id),
    listCatalogue(category),
  ]);

  // Neighbours are the works that have pages of their own — the walk moves
  // page to page, never out to an external site or onto a 404.
  const paged = siblings.filter((s) => workHref(s)?.external === false);
  const at = paged.findIndex((s) => s.id === item.id);
  const previous = at > 0 ? paged[at - 1] : null;
  const next = at >= 0 && at < paged.length - 1 ? paged[at + 1] : null;

  const paragraphs = item.body!.split("\n\n");
  // The opening paragraph is set as a lede only when it is short enough to be
  // one — a long first paragraph in the display size reads as a wall.
  const firstText = paragraphs.findIndex((p) => !p.startsWith("## "));
  const lede = firstText >= 0 && paragraphs[firstText].length <= 280 ? firstText : -1;
  const hasCover = Boolean(item.storage_path);
  // One line under the filmstrip, each distinct credit once — the same credit
  // repeated under every tile would be noise.
  const galleryCredits = [...new Set(gallery.map((image) => image.credit).filter((c): c is string => Boolean(c)))];
  // The artwork is shown whole, at its own ratio — never cropped here. A wide
  // one runs across the page above the title; a poster stands beside it.
  const wide = hasCover && coverShape(item) === "landscape";
  const ratio = item.cover_width && item.cover_height ? item.cover_width / item.cover_height : 3 / 4;

  return (
    <>
      {/* ------------------------------------------------ title card */}
      <ScreeningHero
        eyebrow={
          <nav aria-label="Breadcrumb">
            <Link href="/catalogue" className="hover:text-secondary-foreground">
              Catalogue
            </Link>
            <span aria-hidden="true" className="mx-3">
              /
            </span>
            <Link href={`/catalogue/${category}`} className="hover:text-secondary-foreground">
              {categoryLabel(category)}
            </Link>
          </nav>
        }
        title={item.title}
        lede={item.description}
        backdrop={[item.storage_path, ...gallery.map((image) => image.storage_path)].filter(
          (path): path is string => Boolean(path),
        )}
        stage={
          hasCover ? (
            // The artwork, whole and at its own ratio, lowered onto the stage.
            // The uncropped original is one click away — the link opens the
            // stored file itself, untouched by the optimiser. The credit owed
            // for the image (resources.credit) sits directly under it.
            <figure
              className={cn(
                "mx-auto w-full animate-[hang_1.2s_var(--ease-out-expo)_both] px-4 [animation-delay:560ms] motion-reduce:animate-none sm:px-6",
                wide ? "max-w-4xl" : "max-w-72 sm:max-w-sm",
              )}
            >
              <a
                href={publicStorageUrl(item.storage_path) ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                style={{ aspectRatio: String(ratio) }}
                className="relative block w-full overflow-hidden rounded-sm shadow-2xl ring-1 ring-white/10 outline-offset-4 transition-transform duration-(--dur-slow) ease-expo hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
              >
                <StoredImage
                  path={item.storage_path}
                  alt={item.title}
                  fill
                  quality={90}
                  priority
                  sizes={wide ? "(min-width: 1024px) 896px, 100vw" : "(min-width: 640px) 384px, 288px"}
                />
                <span className="sr-only"> (opens full size in a new tab)</span>
              </a>
              {item.cover_credit ? (
                <figcaption className="mt-3 text-center text-[0.6875rem] leading-relaxed text-muted-foreground">
                  {item.cover_credit}
                </figcaption>
              ) : null}
            </figure>
          ) : undefined
        }
      >
        {/* Hosted recordings play here, in the title card: for an interview
            or a podcast episode, listening IS the work. */}
        {audio.length > 0 ? (
          <AudioPlayer
            className="mt-9 w-full max-w-xl text-left"
            tracks={audio.map((a) => ({ src: publicStorageUrl(a.storage_path)!, title: a.title }))}
          />
        ) : null}

        {links.length > 0 ? (
          <ul className="mt-9 flex flex-wrap justify-center gap-3" aria-label="Where to get it">
            {links.map((link, i) => (
              <li key={link.url}>
                <ButtonLink
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant={i === 0 ? "onBlock" : "onBlockOutline"}
                  size="sm"
                >
                  {link.label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              </li>
            ))}
          </ul>
        ) : null}
      </ScreeningHero>

      {/* ------------------------------------------------ reading room */}
      <section className={cn("pb-16 sm:pb-24", hasCover ? "pt-14 sm:pt-20" : "pt-16 sm:pt-24")}>
        <Container width="narrow">
          <div className="space-y-5 text-[1.0625rem] leading-[1.8]">
            {/* A paragraph starting "## " is a section heading — how a work
                made of parts (The Havana Chronicles' three stories) keeps them
                apart. A short first paragraph is set as the lede. Plain text
                otherwise; no other markup. */}
            {paragraphs.map((para, i) =>
              para.startsWith("## ") ? (
                <h2
                  key={i}
                  className="flex items-baseline gap-4 pt-10 font-display first:pt-0">
                  <span aria-hidden="true" className="h-px w-10 shrink-0 translate-y-[-0.35em] bg-primary" />
                  {para.slice(3)}
                </h2>
              ) : i === lede ? (
                <p key={i} className="font-normal text-2xl leading-snug text-pretty text-foreground sm:text-[1.75rem]">
                  {para}
                </p>
              ) : (
                <p key={i} className="text-pretty text-foreground/85">
                  {para}
                </p>
              ),
            )}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ filmstrip */}
      {gallery.length > 0 ? (
        <section aria-labelledby="gallery-heading" className="border-t border-border py-16 sm:py-20">
          <Container width="wide">
            <h2 id="gallery-heading" className="mb-8 font-display">
              Stills &amp; artwork
            </h2>
            <ul className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
              {gallery.map((image, i) => (
                <li key={image.storage_path} className="shrink-0 snap-start">
                  <a
                    href={publicStorageUrl(image.storage_path) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative block aspect-3/4 w-56 overflow-hidden rounded-sm bg-muted shadow-card outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring sm:w-64 lg:w-72"
                  >
                    <StoredImage
                      path={image.storage_path}
                      alt={`${item.title} — image ${i + 1} of ${gallery.length}`}
                      fill
                      quality={90}
                      sizes="288px"
                      className="object-top transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
                    />
                    <span className="sr-only"> (opens full size in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
            {galleryCredits.length > 0 ? (
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{galleryCredits.join(" · ")}</p>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* ------------------------------------------------ onward */}
      {previous || next ? (
        <nav aria-label="More from this collection" className="border-t border-border">
          <Container width="wide" className="grid sm:grid-cols-2">
            <Neighbour item={previous} direction="previous" />
            <Neighbour item={next} direction="next" />
          </Container>
        </nav>
      ) : null}
    </>
  );
}

function Neighbour({ item, direction }: { item: CatalogueItem | null; direction: "previous" | "next" }) {
  if (!item) return <div className="hidden sm:block" />;
  const isNext = direction === "next";

  return (
    <Link
      href={`/catalogue/${item.category}/${item.slug}`}
      className={cn(
        "group flex items-center gap-5 py-10 outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring sm:py-14",
        isNext ? "sm:flex-row-reverse sm:border-l sm:border-border sm:pl-10 sm:text-right" : "sm:pr-10",
      )}
    >
      {item.storage_path ? (
        <span className="relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-sm shadow-card sm:w-20">
          <StoredImage path={item.storage_path} alt="" fill sizes="80px" className={COVER_FOCUS_CLASS[item.cover_focus]} />
        </span>
      ) : null}
      <span className="min-w-0">
        <span className="block text-xs font-semibold tracking-[0.28em] text-muted-foreground uppercase">
          {isNext ? "Next work →" : "← Previous work"}
        </span>
        <span className="mt-2 block font-display text-2xl leading-tight font-semibold text-balance transition-colors duration-(--dur-base) group-hover:text-primary sm:text-3xl">
          {item.title}
        </span>
      </span>
    </Link>
  );
}
