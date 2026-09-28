import Link from "next/link";

import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { ExternalMark } from "@/components/navigation/ExternalMark";
import { COVER_FOCUS_CLASS, awaitingLink, categoryLabel, showsWhole, workHref, type CatalogueItem } from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";

/**
 * One work in the catalogue, as a poster on a wall — note 10 §27, §42.
 *
 * NO CARD. The earlier version put each cover in a bordered box with a text
 * panel beneath — the anatomy of a blog index, which is what the catalogue
 * read as. A studio shows its work bare: the artwork, and the title set
 * beneath it in the display face. The artwork is the chrome.
 *
 * ONE RATIO FOR EVERY WORK (3:4), shared so a row keeps one baseline, and the
 * artwork FILLS it, cropped to keep the edge its title sits on (`cover_focus`).
 * The crops were checked against this ratio, so it is not changed lightly; the
 * whole artwork is on the work's own page.
 *
 * THE HOVER GLOW IS THE WORK'S OWN COLOUR: a blurred copy of the cover behind
 * the frame, fetched at 64px, so a poster lights the wall in its own palette
 * rather than a site accent. Only works that lead somewhere react at all (see
 * `workHref`) — a tile that goes nowhere does not pretend to.
 *
 * TWO FORMS. A portrait or square cover is a POSTER, captioned beneath. A
 * landscape cover is a STILL: it spans two columns of the wall, the image is
 * the tile's background, and the title and line are set over it on a
 * dark gradient — so a wide film still is shown wide instead of losing half
 * its width to a portrait frame, and the wall gets a rhythm of posters and
 * stills. The caller chooses the form (and the column span) from `coverShape`.
 */
export function WorkCard({
  item,
  priority = false,
  sizes = "(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw",
  tone = "page",
  form = "poster",
}: {
  item: CatalogueItem;
  /** True for the first row only — everything below the fold stays lazy. */
  priority?: boolean;
  sizes?: string;
  /** "ink" when the tile sits on the dark screening-room field. */
  tone?: "page" | "ink";
  /** "still" for a landscape cover laid across two columns — see above. */
  form?: "poster" | "still";
}) {
  if (form === "still" && item.storage_path) return <StillCard item={item} priority={priority} />;
  const link = workHref(item);
  const muted = tone === "ink" ? "text-secondary-foreground/65" : "text-muted-foreground";
  // Show artwork (see `showsWhole`) sits whole in the frame; books and films
  // keep the 3:4 crops already chosen for them with `cover_focus`.
  const whole = showsWhole(item);

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative isolate">
        {link && item.storage_path ? (
          <div
            aria-hidden="true"
            className="absolute inset-3 -z-10 opacity-0 transition-opacity duration-(--dur-slow) ease-expo group-hover:opacity-80 motion-reduce:transition-none"
          >
            <StoredImage path={item.storage_path} alt="" fill sizes="64px" className="scale-125 blur-2xl" />
          </div>
        ) : null}

        <div
          className={cn(
            "relative aspect-3/4 overflow-hidden rounded-sm bg-surface-muted shadow-card",
            link &&
              "transition-[transform,box-shadow] duration-(--dur-base) ease-expo group-hover:-translate-y-1.5 group-hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none",
          )}
        >
          {item.storage_path && whole ? (
            /*
              SHOW ARTWORK SITS WHOLE. Podcast art, station logos and video
              thumbnails are lettered edge to edge: a 3:4 crop cut them ("HOPE
              fm" read "OPE") and a still's overlaid title collided with their
              own lettering. The artwork is shown uncropped in the middle of
              the frame, over a blurred copy of itself, so the poster keeps
              one shape without bars or a cut-off logo.
            */
            <>
              <StoredImage
                path={item.storage_path}
                alt=""
                fill
                sizes="64px"
                className="scale-150 blur-2xl"
              />
              <StoredImage
                path={item.storage_path}
                alt={item.title}
                fill
                fit="contain"
                quality={90}
                priority={priority}
                sizes={sizes}
                className={cn(
                  "drop-shadow-xl",
                  link &&
                    "transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none",
                )}
              />
            </>
          ) : item.storage_path ? (
            <StoredImage
              path={item.storage_path}
              alt={item.title}
              fill
              quality={90}
              priority={priority}
              sizes={sizes}
              className={cn(
                COVER_FOCUS_CLASS[item.cover_focus],
                link &&
                  "transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none",
              )}
            />
          ) : (
            /*
              No artwork exists for this work. Rather than an empty grey frame,
              it gets a cover drawn from its own title (see GeneratedCover) —
              deterministic, never repeated, and never an unrelated stock photo.
            */
            // The title is printed directly beneath, so the drawn cover
            // carries the collection's name instead of repeating it.
            <GeneratedCover
              title={item.title}
              seed={item.slug}
              showTitle={false}
              eyebrow={categoryLabel(item.category)}
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col">
        {awaitingLink(item) ? <ComingSoon className="mb-2 self-start" /> : null}
        <h3 className="font-display text-lg leading-snug font-semibold text-balance">
          {link ? (
            <Link
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              // The whole tile is the target: the link's box is stretched over
              // the article, so the accessible name stays just the title.
              className="decoration-1 underline-offset-4 outline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-ring"
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
          {link?.external ? <ExternalMark className="ml-1.5 inline-block h-3 w-3 align-baseline opacity-70" /> : null}
        </h3>
        {item.description ? (
          <p className={cn("mt-1.5 line-clamp-2 text-sm leading-relaxed", muted)}>{item.description}</p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * A landscape work as a still: the image fills the tile and the text sits on
 * it. On a phone the tile has a whole row to itself, so it keeps a wide 8:5
 * frame; from md up it shares a row with posters and stretches to their height.
 */
function StillCard({ item, priority }: { item: CatalogueItem; priority: boolean }) {
  const link = workHref(item);

  return (
    <article className="group relative isolate flex aspect-8/5 h-full flex-col justify-end overflow-hidden rounded-sm bg-secondary text-secondary-foreground shadow-card md:aspect-auto md:min-h-80">
      <StoredImage
        path={item.storage_path}
        alt={item.title}
        fill
        quality={90}
        priority={priority}
        sizes="(min-width: 1280px) 46vw, (min-width: 768px) 62vw, 100vw"
        className={cn(
          "-z-10",
          COVER_FOCUS_CLASS[item.cover_focus],
          link &&
            "transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none",
        )}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-t from-black/85 via-black/35 to-transparent"
      />

      <div className="p-5 sm:p-7">
        {awaitingLink(item) ? <ComingSoon tone="dark" className="mb-3" /> : null}
        <h3 className="font-display text-2xl leading-tight font-semibold text-balance text-white sm:text-3xl">
          {link ? (
            <Link
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="decoration-1 underline-offset-4 outline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-white"
            >
              {item.title}
            </Link>
          ) : (
            item.title
          )}
          {link?.external ? <ExternalMark className="ml-2 inline-block h-3.5 w-3.5 align-baseline opacity-80" /> : null}
        </h3>
        {item.description ? (
          <p className="mt-2 line-clamp-2 max-w-xl text-sm leading-relaxed text-white/80">{item.description}</p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * "Coming soon" on a recording or video whose link has not arrived yet
 * (`awaitingLink`). The card has no link and no hover, so this says why —
 * without it, a card that does nothing on click reads as broken.
 */
export function ComingSoon({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-[0.625rem] font-semibold tracking-[0.16em] uppercase",
        tone === "dark" ? "border-white/40 bg-black/60 text-white backdrop-blur-sm" : "border-border text-muted-foreground",
        className,
      )}
    >
      Coming soon
    </span>
  );
}
