/**
 * Photographer credits for the static photos in `public/images/`.
 *
 * The client supplied these and asked that each be credited on the page. Tony's
 * wording (2026-11-02): "Photos of Tony Klinger by Danny Clifford", replacing
 * the old sites' "Photos courtesy of Danny Clifford Photographer". The footer
 * carries the same line once for the whole site. The map records who took
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
export type Photographer = {
  name: string;
  url?: string;
  /** Who the photos are of, where the credit names them: "Photos of Tony Klinger by …". */
  subject?: string;
};

/** Linked from every credit — the client asked for the name to reach his site. */
export const DANNY_CLIFFORD: Photographer = {
  name: "Danny Clifford",
  url: "https://www.dannyclifford.com/",
  subject: "Tony Klinger",
};

const CREDITS: Record<string, Photographer> = {
  "/images/extra-8b67cc2b.webp": DANNY_CLIFFORD,
  "/images/extra-08b496ca.webp": DANNY_CLIFFORD,
  "/images/extra-9af9b2df.webp": DANNY_CLIFFORD,
  "/images/extra-10ab813f.webp": DANNY_CLIFFORD,
  "/images/extra-23b3b03e.webp": DANNY_CLIFFORD,
  "/images/extra-77a66a05.webp": DANNY_CLIFFORD,
  "/images/extra-84c22937.webp": DANNY_CLIFFORD,
  "/images/extra-a3f3b1e6.webp": DANNY_CLIFFORD,
  "/images/extra-a791c80e.webp": DANNY_CLIFFORD,
  "/images/extra-d64ac0c2.webp": DANNY_CLIFFORD,
  "/images/extra-ed28353c.webp": DANNY_CLIFFORD,
  "/images/extra-fe79e111.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-1.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-7.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-8.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-14.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-15.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-17.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-19.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-21.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-22.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-23.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-24.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-25.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-26.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-27.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-32.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-33.webp": DANNY_CLIFFORD,
  "/images/tk-dc-0-34.webp": DANNY_CLIFFORD,
};

/** Who took a `public/images` photo, or null when none is recorded. */
export function photographer(src: string): Photographer | null {
  return CREDITS[src] ?? null;
}

/**
 * The credit owed for one or more photos shown together, or null when none of
 * them is credited: the lead-in ("Photo of Tony Klinger by", or "Photos courtesy
 * of" where no subject is recorded) and each
 * photographer once, in order, so the caller can link every name.
 */
export function photoCredit(
  src: string | readonly string[],
): { lead: string; photographers: Photographer[] } | null {
  const srcs = typeof src === "string" ? [src] : src;
  const credited = srcs.filter((s) => CREDITS[s]);
  if (credited.length === 0) return null;

  const photographers = [...new Set(credited.map((s) => CREDITS[s]))];
  const noun = credited.length === 1 ? "Photo" : "Photos";
  // One subject shared by every photographer named: "Photo of Tony Klinger by".
  const subjects = [...new Set(photographers.map((p) => p.subject))];
  const subject = subjects.length === 1 ? subjects[0] : undefined;
  return {
    lead: subject ? `${noun} of ${subject} by` : `${noun} courtesy of`,
    photographers,
  };
}
