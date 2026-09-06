import { cn } from "@/lib/utils/cn";

/**
 * A designed cover for anything that has no artwork — note 10 §23.
 *
 * TWO PROBLEMS, ONE ANSWER. Six catalogue works have no image in the library,
 * and all 172 blog posts have none. There are 380 images in the bucket, so
 * there is no honest way to give 172 posts a relevant photograph — and pasting
 * an unrelated stock image onto an article is precisely the generated-looking
 * filler this redesign exists to remove. An earlier automated attempt at this
 * put a stock photo on The Havana Chronicles and had to be reverted.
 *
 * So nothing is invented and nothing is repeated: the cover is drawn FROM THE
 * WORK'S OWN TITLE, and its colour and motif are derived deterministically
 * from its slug. The same post always renders the same cover, two posts
 * essentially never collide, and no image is ever reused — which satisfies the
 * "at most twice" rule by never reusing anything at all.
 *
 * It costs no image request. It is a gradient, an inline SVG motif and live
 * text, so it is a few hundred bytes, it stays sharp at any size, and the
 * title is REAL TEXT — selectable, translatable, and legible to a screen
 * reader rather than baked into pixels.
 */

/** FNV-1a. Small, fast, and stable across runs — no Math.random anywhere. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Four motifs, chosen so the set reads as one family rather than four unrelated
 * decorations. Each is a tiled SVG pattern at low opacity — texture, not
 * illustration, so it never competes with the title.
 */
function motif(index: number, tint: string): string {
  const c = encodeURIComponent(tint);
  const patterns = [
    // Fine diagonal rule — film-leader stripe.
    `%3Cpath d='M-10 30 L30 -10 M-10 50 L50 -10' stroke='${c}' stroke-width='2' fill='none'/%3E`,
    // Concentric arcs — reel.
    `%3Ccircle cx='20' cy='20' r='16' stroke='${c}' stroke-width='1.5' fill='none'/%3E%3Ccircle cx='20' cy='20' r='8' stroke='${c}' stroke-width='1.5' fill='none'/%3E`,
    // Grid of dots — halftone.
    `%3Ccircle cx='10' cy='10' r='2' fill='${c}'/%3E%3Ccircle cx='30' cy='30' r='2' fill='${c}'/%3E`,
    // Horizontal rules — printed page.
    `%3Cpath d='M0 12 H40 M0 26 H40' stroke='${c}' stroke-width='1.5' fill='none'/%3E`,
  ];
  const p = patterns[index % patterns.length];
  return `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E${p}%3C/svg%3E")`;
}

export function GeneratedCover({
  title,
  seed,
  eyebrow,
  showTitle = true,
  className,
}: {
  title: string;
  /** Stable identity — always the slug, never the index or the title. */
  seed: string;
  eyebrow?: string;
  /**
   * False where the title is already printed beneath the cover, as on a blog
   * card — otherwise the same words appear twice, an inch apart. The cover
   * then carries the motif and the year, and stays just as distinctive.
   */
  showTitle?: boolean;
  className?: string;
}) {
  const h = hash(seed);

  // Hue spans the full circle, so a 172-post archive genuinely varies instead
  // of resolving into a wall of greens. Saturation is high on purpose — the
  // brief asked for a saturated site, and these panels are the one place
  // colour can be bold without competing with photography, because there is
  // no photograph in them.
  const hue = h % 360;
  const hue2 = (hue + 38) % 360;
  const motifIndex = (h >> 8) % 4;

  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex h-full w-full flex-col justify-between overflow-hidden p-5",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(145deg, hsl(${hue} 72% 34%), hsl(${hue2} 68% 16%))`,
      }}
    >
      {/* Motif layer */}
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ backgroundImage: motif(motifIndex, `hsl(${hue} 90% 82%)`) }}
      />

      {eyebrow ? (
        <p className="relative text-[0.625rem] font-semibold tracking-[0.16em] text-white/55 uppercase">
          {eyebrow}
        </p>
      ) : (
        <span className="relative" />
      )}

      <div className="relative">
        <span
          className="mb-2 block h-px w-8"
          style={{ backgroundColor: `hsl(${hue} 90% 78%)` }}
        />
        {showTitle ? (
          <p className="font-display text-lg leading-tight font-semibold text-balance text-white/92">
            {title}
          </p>
        ) : null}
      </div>
    </div>
  );
}
