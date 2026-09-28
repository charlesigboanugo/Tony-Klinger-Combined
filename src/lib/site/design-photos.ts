import type { DesignImage } from "@/components/media/DesignPhoto";

/**
 * Where each design photo in `public/images/` is placed — note 10 §42.3.
 *
 * ONE PLACE PER PHOTO. The owner wants the site saturated with photography
 * without the same frame turning up twice, so every placement is named here
 * and pages import their photo by that name. Adding a placement means picking
 * a file not already listed below.
 *
 * YELLOW IS RATIONED (owner's rule). Eight photos share the yellow backdrop
 * (tagged `yellow` below). At most two page heroes use one — Give-Get-Go
 * only since the About hero moved to a blue-backdrop portrait (2026-09-25) —
 * and no two neighbouring sections on a page are both yellow. The rest sit
 * mid-page, between sections that carry no photo or a different backdrop.
 *
 * Deliberately NOT placed:
 *   extra-23b3b03e  a phone screenshot of a BBC Sounds page (third-party
 *                   branding, another person) — not a photograph to decorate
 *                   with, and not one the photographer credit can honestly
 *                   cover.
 */
const tony = "Tony Klinger";

export const designPhotos = {
  // Home — hero (noir), marquee (no photo), About Tony, catalogue band (no
  // photo), banner (yellow). The coaching pitch has no photo since
  // 2026-09-26 (owner: too long), so `homeCoaching` is unplaced.
  // The hero is shot on black, and the hero field is matched to that black
  // (`--block-noir`), so the photo dissolves into the page instead of framing.
  homeHero: {
    src: "/images/extra-10ab813f.avif",
    alt: `${tony}, arms folded, against a black backdrop`,
  },
  // Tony sits right of centre in this landscape frame; a centred crop into the
  // tall split cut his face at the edge, so the crop is pulled right.
  homeAbout: {
    src: "/images/tk-dc-0-15.avif",
    alt: `${tony}, smiling`,
    focus: "object-[70%_0%]",
  },
  // The "Six decades" feature frames this at nearly its own 3:2 shape and
  // pins it to the top, so the head is never cropped.
  homeBanner: {
    src: "/images/tk-dc-0-24.avif",
    alt: `${tony}, smiling`,
    focus: "object-top",
  }, // yellow
  // Shows the offer itself (owner, 2026-09-24): Tony seated among a small
  // group after a talk — the "eight at most" room the section describes. From
  // the old main site's news archive, uncredited like `coachingHero` (same
  // evening, different page). Replaced the warehouse portrait, now unplaced.
  // Unplaced on home since 2026-09-26; now the faint backdrop of the public
  // Academy landing hero (`AcademyLanding`), its one placement.
  homeCoaching: {
    src: "/images/talk-small-group.avif",
    alt: `${tony} seated among a small group, talking with them`,
  },
  // The closing band's faint backdrop: Tony beside a film camera outside a
  // cinema. Black and white, from the old main site; uncredited.
  closing: {
    src: "/images/cinema-camera-bw.avif",
    alt: `${tony} beside a film camera outside a cinema`,
    focus: "object-[70%_30%]",
  },

  // About — split hero (noir), story chapters (covers, no design photo),
  // the line (noir, black and white), recognition (no photo), mosaic,
  // closing quote.
  // Tony in a black cap against a dark blue wall (owner, 2026-09-25): dark
  // enough to dissolve into the noir field, and unlike anything on the home
  // page. Replaced the yellow portrait, a car-park frame and the blue
  // looking-up portrait (a twin of home's About Tony frame, now on Events).
  aboutHero: {
    src: "/images/extra-fe79e111.avif",
    alt: `${tony} in a cap, against a dark blue wall`,
    focus: "object-[65%_center] lg:object-[62%_center]",
  },
  aboutBanner: {
    src: "/images/extra-8b67cc2b.avif",
    alt: `${tony}, black and white portrait`,
    // Tony stands in the right third; the phone crop centres on him, and
    // from lg the frame is shown nearly whole.
    focus: "object-[78%_20%] lg:object-[60%_20%]",
  },
  // Yellow and blue alternate, so the grid reads as a contact sheet.
  aboutMosaic: [
    { src: "/images/tk-dc-0-14.avif", alt: `${tony}, smiling` },
    { src: "/images/tk-dc-0-19.avif", alt: `${tony}, looking up` }, // yellow
    { src: "/images/tk-dc-0-1.avif", alt: `${tony}, thinking` },
    { src: "/images/tk-dc-0-25.avif", alt: `${tony}, looking up` }, // yellow
    { src: "/images/tk-dc-0-7.avif", alt: `${tony}, laughing` },
  ],
  // Testimonials: the room itself — Tony on stage at a Q&A at Tyneside
  // Cinema, the audience in silhouette in the foreground (owner, 2026-09-25:
  // a photo not used anywhere before). From the old main site, uncredited
  // like the other talk photos. Shown whole in the noir "screening room"
  // header, its edges dissolved, so no crop focus is needed. Replaced
  // `tk-dc-0-8`, now the auth stage.
  testimonials: {
    src: "/images/tyneside-qa.avif",
    alt: `${tony} on stage at a Q&A at Tyneside Cinema, seen from the audience`,
  },
  // The "Passing it on" chapter: Tony standing among a small group after a
  // talk. Same evening as `coachingHero`/`homeCoaching`, on a different page;
  // from the old main site, uncredited.
  aboutTalk: {
    src: "/images/talk-group-standing.avif",
    alt: `${tony} standing among a small group after a talk, listening`,
  },

  // Coaching — full-bleed hero, offers, how it works, membership, voices.
  // The hero shows the work itself, not a studio portrait (owner, 2026-09-24):
  // Tony mid-explanation with two people after a talk. From the old main
  // site's news archive, not Danny Clifford's shoot, so it carries no credit
  // until the client names the photographer.
  coachingHero: {
    src: "/images/talk-conversation.avif",
    alt: `${tony} in conversation with two people in a small room after a talk`,
    focus: "object-[48%_center]",
  },
  // Unplaced since the 2026-09-26 rebuild put the room itself full-bleed at
  // the top; a second full-bleed photo lower down repeated the device.
  coachingBanner: {
    src: "/images/tk-dc-0-26.avif",
    alt: `${tony}, looking up and smiling`,
    focus: "object-[50%_14%]",
  }, // yellow
  // Memberships — pricing (no photo), then this banner (yellow).
  memberships: {
    src: "/images/tk-dc-0-27.avif",
    alt: `${tony}, smiling`,
    focus: "object-[50%_5%]",
  }, // yellow
  courses: {
    src: "/images/extra-a3f3b1e6.avif",
    alt: `${tony} reading at his desk`,
    focus: "object-top",
  },
  cohorts: {
    src: "/images/extra-a791c80e.avif",
    alt: `${tony} in a warehouse, arms folded`,
  },
  groupCoaching: {
    src: "/images/extra-84c22937.avif",
    alt: `${tony}, arms folded`,
    focus: "object-[60%_center]",
  },
  privateCoaching: {
    src: "/images/tk-dc-0-32.avif",
    alt: `${tony}, black and white portrait`,
  },
  retreats: {
    src: "/images/extra-08b496ca.avif",
    alt: `${tony} in a sunlit courtyard`,
    focus: "object-[70%_center]",
  },

  // Elsewhere
  // Moved here from the home hero (2026-09-24) when home took the black-
  // backdrop frame. Still two yellow heroes site-wide: About and this.
  giveGetGo: {
    src: "/images/tk-dc-0-34.avif",
    alt: `${tony}, hand on chin`,
    focus: "object-[60%_center]",
  }, // yellow
  giveGetGoBanner: {
    src: "/images/tk-dc-0-23.avif",
    alt: `${tony}, black and white portrait`,
  },
  blog: {
    src: "/images/extra-9af9b2df.avif",
    alt: `${tony} holding an open book`,
    focus: "object-top",
  },
  // Moved here from the About hero (2026-09-25), which took this page's
  // cap portrait.
  events: {
    src: "/images/tk-dc-0-17.avif",
    alt: `${tony}, looking up`,
    focus: "object-[50%_20%]",
  },
  contact: {
    src: "/images/extra-77a66a05.avif",
    alt: `${tony} in a cap`,
    focus: "object-[65%_8%]",
  },
  welcome: {
    src: "/images/extra-ed28353c.avif",
    alt: `${tony}, black and white portrait in a cap`,
    focus: "object-top",
  },
  // Auth — the stage panel beside every sign-in form. Tony laughing against
  // a blue backdrop (owner, 2026-09-26: a photo not used anywhere else),
  // replacing the car-park deck (`extra-d64ac0c2`, now unplaced). The studio
  // vignette darkens the corners, so the frame sinks into the noir stage;
  // not yellow, so the ration is untouched. His face sits just above centre:
  // the tall desktop crop keeps it clear of the line at the foot, and the
  // short phone band pulls up to it.
  auth: {
    src: "/images/tk-dc-0-8.avif",
    alt: `${tony}, laughing`,
    focus: "object-[50%_18%] lg:object-[48%_center]",
  },
} satisfies Record<string, DesignImage | DesignImage[]>;
