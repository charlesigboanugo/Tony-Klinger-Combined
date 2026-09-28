/**
 * Photographer credits for the static photos in `public/images/`.
 *
 * The client supplied these and asked that each be credited on the page as
 * "Photos courtesy of Danny Clifford Photographer". The map records who took
 * each photo, not the sentence: the line is built from the photographer's name
 * so it reads "Photo" under one image and "Photos" when a credit covers
 * several. The list is deliberately explicit, file by file: it covers the
 * images present when the credit was requested (2026-09-24), not the folder. A
 * photo added later is uncredited until the client says whose it is — then add
 * it here.
 *
 * Pages render it with `<PhotoCredit>` — as a caption under a framed photo, or
 * as an overlay in the corner when the photo is a background.
 */
export type Photographer = { name: string; url?: string };

/** Linked from every credit — the client asked for the name to reach his site. */
const DANNY_CLIFFORD: Photographer = {
  name: "Danny Clifford Photographer",
  url: "https://www.dannyclifford.com/",
};

const CREDITS: Record<string, Photographer> = {
  "/images/extra-8b67cc2b.avif": DANNY_CLIFFORD,
  "/images/extra-08b496ca.avif": DANNY_CLIFFORD,
  "/images/extra-9af9b2df.avif": DANNY_CLIFFORD,
  "/images/extra-10ab813f.avif": DANNY_CLIFFORD,
  "/images/extra-23b3b03e.avif": DANNY_CLIFFORD,
  "/images/extra-77a66a05.avif": DANNY_CLIFFORD,
  "/images/extra-84c22937.avif": DANNY_CLIFFORD,
  "/images/extra-a3f3b1e6.avif": DANNY_CLIFFORD,
  "/images/extra-a791c80e.avif": DANNY_CLIFFORD,
  "/images/extra-d64ac0c2.avif": DANNY_CLIFFORD,
  "/images/extra-ed28353c.avif": DANNY_CLIFFORD,
  "/images/extra-fe79e111.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-1.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-7.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-8.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-14.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-15.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-17.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-19.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-21.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-22.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-23.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-24.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-25.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-26.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-27.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-32.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-33.avif": DANNY_CLIFFORD,
  "/images/tk-dc-0-34.avif": DANNY_CLIFFORD,
};

/** Who took a `public/images` photo, or null when none is recorded. */
export function photographer(src: string): Photographer | null {
  return CREDITS[src] ?? null;
}

/**
 * The credit owed for one or more photos shown together, or null when none of
 * them is credited: the lead-in ("Photo" or "Photos courtesy of") and each
 * photographer once, in order, so the caller can link every name.
 */
export function photoCredit(
  src: string | readonly string[],
): { lead: string; photographers: Photographer[] } | null {
  const srcs = typeof src === "string" ? [src] : src;
  const credited = srcs.filter((s) => CREDITS[s]);
  if (credited.length === 0) return null;

  const photographers = [...new Set(credited.map((s) => CREDITS[s]))];
  return {
    lead: `${credited.length === 1 ? "Photo" : "Photos"} courtesy of`,
    photographers,
  };
}
