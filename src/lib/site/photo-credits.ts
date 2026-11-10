import { photos } from "@/lib/site/photos";

/**
 * Photographer credits for the design photos in `src/assets/images/`.
 *
 * Keyed by each photo's fingerprinted URL (`photos.ts`), which is the `src`
 * every page passes to `<PhotoCredit>`.
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
  [photos["extra-8b67cc2b"]]: DANNY_CLIFFORD,
  [photos["extra-08b496ca"]]: DANNY_CLIFFORD,
  [photos["extra-9af9b2df"]]: DANNY_CLIFFORD,
  [photos["extra-10ab813f"]]: DANNY_CLIFFORD,
  [photos["extra-23b3b03e"]]: DANNY_CLIFFORD,
  [photos["extra-77a66a05"]]: DANNY_CLIFFORD,
  [photos["extra-84c22937"]]: DANNY_CLIFFORD,
  [photos["extra-a3f3b1e6"]]: DANNY_CLIFFORD,
  [photos["extra-a791c80e"]]: DANNY_CLIFFORD,
  [photos["extra-d64ac0c2"]]: DANNY_CLIFFORD,
  [photos["extra-ed28353c"]]: DANNY_CLIFFORD,
  [photos["extra-fe79e111"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-1"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-7"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-8"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-14"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-15"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-17"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-19"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-21"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-22"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-23"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-24"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-25"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-26"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-27"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-32"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-33"]]: DANNY_CLIFFORD,
  [photos["tk-dc-0-34"]]: DANNY_CLIFFORD,
};

/** Who took a design photo, or null when none is recorded. */
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
