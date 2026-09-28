import { WorkCard } from "@/components/content/WorkCard";
import { Reveal } from "@/components/motion/Reveal";
import { wallForm, type CatalogueItem } from "@/lib/content/catalogue";
import { cn } from "@/lib/utils/cn";

/** A breakpoint of the wall and how many columns it has there. */
type Tier = "base" | "md" | "lg";

/**
 * Where CSS grid's `grid-flow-dense` auto-placement puts each work in a grid
 * of `columns`: every item goes in the first gap it fits, scanning from the
 * top. Returns the row each item lands on, and which rows are left with a gap.
 */
function densePlacement(spans: number[], columns: number) {
  const grid: boolean[][] = [];
  const rowOf = spans.map((span) => {
    for (let r = 0; ; r++) {
      grid[r] ??= Array<boolean>(columns).fill(false);
      for (let c = 0; c + span <= columns; c++) {
        if (grid[r].slice(c, c + span).every((taken) => !taken)) {
          for (let k = c; k < c + span; k++) grid[r][k] = true;
          return r;
        }
      }
    }
  });
  const open = grid.map((row) => row.some((taken) => !taken));
  return { rowOf, open, last: grid.length - 1 };
}

/**
 * Classes per tier, written out in full so Tailwind's scanner sees each one.
 * `hide` hides a card at a tier; `show` shows it again; `w` sizes a centred
 * card to exactly one (or two) of that tier's columns.
 */
const HIDE: Record<Tier, string> = { base: "hidden", md: "md:hidden", lg: "lg:hidden" };
const SHOW: Record<Tier, string> = { base: "block", md: "md:block", lg: "lg:block" };
const FLEX: Record<Tier, string> = { base: "flex", md: "md:flex", lg: "lg:flex" };
const POSTER_W: Record<Tier, Record<number, string>> = {
  base: { 2: "w-[calc((100%-var(--gx))/2)]" },
  md: { 4: "md:w-[calc((100%-3*var(--gx))/4)]" },
  lg: {
    4: "lg:w-[calc((100%-3*var(--gx))/4)]",
    5: "lg:w-[calc((100%-4*var(--gx))/5)]",
  },
};
const STILL_W: Record<Tier, Record<number, string>> = {
  base: { 2: "w-full" },
  md: { 4: "md:w-[calc((100%-var(--gx))/2)]" },
  lg: {
    4: "lg:w-[calc((100%-var(--gx))/2)]",
    5: "lg:w-[calc(2*(100%-4*var(--gx))/5+var(--gx))]",
  },
};

/**
 * A collection's works — note 10 §42.1.
 *
 * Posters take one column, landscape stills two, packed with
 * `grid-flow-dense` so a poster fills the gap a still leaves. Two columns on
 * phones, four on tablets, FIVE from desktop up (owner, 2026-09-25) — unless
 * five would leave a gap mid-grid that no poster can fill (a collection of
 * stills: two stills make four columns of five), in which case desktop keeps
 * four. Each collection is decided from its own works.
 *
 * THE LAST ROW IS CENTRED. A grid ends flush left, so a collection whose count
 * does not fill its final row trailed off into empty space. The works on that
 * row are shown in a centred row beneath the grid instead, at exactly the
 * grid's column widths. Which works those are depends on the column count, so
 * it is worked out for each tier by replaying the grid's own dense placement,
 * and every row above is unchanged. A work on the last row at some tiers but
 * not others is rendered in both places and shown in one: `display:none` also
 * removes the hidden copy from the accessibility tree, so it is announced once.
 */
export function WorkWall({ items }: { items: CatalogueItem[] }) {
  const forms = items.map(wallForm);
  const spans = forms.map((form) => (form === "still" ? 2 : 1));

  const five = densePlacement(spans, 5);
  const desktop = five.open.slice(0, five.last).some(Boolean) ? 4 : 5;
  const columns: Record<Tier, number> = { base: 2, md: 4, lg: desktop };
  const tiers: Tier[] = ["base", "md", "lg"];

  // For each tier: the ids of works that belong in the centred row there.
  const tail = Object.fromEntries(
    tiers.map((tier) => {
      const { rowOf, open, last } = densePlacement(spans, columns[tier]);
      const ids = open[last] ? items.filter((_, i) => rowOf[i] === last).map((item) => item.id) : [];
      return [tier, new Set(ids)];
    }),
  ) as Record<Tier, Set<string>>;

  // Visibility per tier, only where it changes from the tier below.
  const visibility = (id: string, inTail: boolean) =>
    tiers
      .map((tier, t) => {
        const here = tail[tier].has(id) === inTail;
        const below = t > 0 && tail[tiers[t - 1]].has(id) === inTail;
        if (t === 0) return here ? "" : HIDE.base;
        if (here === below) return "";
        return here ? SHOW[tier] : HIDE[tier];
      })
      .filter(Boolean);

  const card = (item: CatalogueItem, i: number, className: string) => (
    <Reveal
      as="li"
      key={item.id}
      // Stagger across the row, not the whole list: a 40-item grid
      // multiplying the index would delay the last by seconds.
      delay={(i % columns.lg) * 60}
      className={cn("h-full", className)}
    >
      <WorkCard item={item} form={forms[i] === "still" ? "still" : "poster"} priority={i < columns.lg} />
    </Reveal>
  );

  const inGrid = items.map((item) => visibility(item.id, false));
  const inTail = items.map((item) => visibility(item.id, true));
  const anyTail = tiers.some((tier) => tail[tier].size > 0);

  return (
    // One gap value, shared by the grid and the centred row beneath it, so
    // the centred cards are exactly as wide as the columns above them.
    <div className="[--gx:1.25rem] sm:[--gx:2rem] xl:[--gx:2.5rem]">
      <ul
        className={cn(
          "grid grid-flow-dense grid-cols-2 gap-x-(--gx) gap-y-12 md:grid-cols-4",
          desktop === 5 && "lg:grid-cols-5",
        )}
      >
        {items.map((item, i) =>
          tiers.every((tier) => tail[tier].has(item.id))
            ? null
            : card(item, i, cn(forms[i] === "still" && "col-span-2", ...inGrid[i])),
        )}
      </ul>

      {anyTail ? (
        <ul
          className={cn(
            "mt-12 flex-wrap justify-center gap-x-(--gx) gap-y-12",
            // Shown only at the tiers that have a centred row, so an empty one
            // never adds its margin.
            ...tiers.map((tier) => (tail[tier].size > 0 ? FLEX[tier] : HIDE[tier])),
          )}
        >
          {items.map((item, i) => {
            if (!tiers.some((tier) => tail[tier].has(item.id))) return null;
            const widths = forms[i] === "still" ? STILL_W : POSTER_W;
            return card(
              item,
              i,
              cn(...tiers.map((tier) => widths[tier][columns[tier]]), ...inTail[i]),
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
