/**
 * When an offer is on, said in one line that can be SEEN — note 10.
 *
 * The owner (2026-10-09): the start date, and that something is running or
 * closing soon, must be much more visible on the cards and product pages. It
 * was a line of small grey text at the foot of the card. It is now a chip on
 * the photograph (`OfferStatusChip`), and this decides what the chip says and
 * how loudly.
 *
 *   live     on sale or running: teal, the site's colour for state
 *   urgent   closing or ending soon, or nearly full: white with a red mark,
 *            the loudest thing on the card after the price
 *   quiet    nothing to act on yet: no date, or fully booked
 *   closed   under way or past registration with nothing left to buy: said
 *            as "closed", with a padlock, so nobody goes looking for a button
 *
 * The clock is read here, not in a page: pages are pre-built and may not read
 * it while rendering (note 10 §47.1).
 */
export type OfferStatus = { label: string; tone: "live" | "urgent" | "quiet" | "closed" };

/** One running of something sold by registration: a series run, a cohort intake. */
export type OfferPhase = {
  state: "upcoming" | "open" | "full" | "sessions" | "in_progress";
  registrationOpensAt: string;
  /** When registration closes. The start, where the offer has no earlier date. */
  registrationClosesAt?: string;
  startsAt: string;
  endsAt: string;
  placesLeft: number | null;
};

/**
 * What else can be bought once the main offer has closed. A Group Coaching
 * series sells its sessions singly after registration closes; a cohort sells
 * nothing more, so it is simply closed.
 */
export type OfferExtras = {
  /** Sessions still to come that have a seat. Leave out where none are ever sold singly. */
  singleSessionsLeft?: number;
};

const DAY_MS = 86_400_000;
/** Registration closing within this many days is said as urgent. */
const CLOSING_SOON_DAYS = 7;
/** This few places left is said as urgent. */
const FEW_PLACES = 3;

const UK = "Europe/London";

/** "23 October", with the year only where it is not this year. */
function day(value: string, now: number): string {
  const date = new Date(value);
  const sameYear =
    date.toLocaleDateString("en-GB", { year: "numeric", timeZone: UK }) ===
    new Date(now).toLocaleDateString("en-GB", { year: "numeric", timeZone: UK });
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: UK,
  });
}

function inDays(target: string, now: number): string {
  const days = Math.ceil((+new Date(target) - now) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** The status of an offer from its runs or intakes, the most actionable first. */
export function phaseStatus(phases: OfferPhase[], extras: OfferExtras = {}): OfferStatus {
  const now = Date.now();
  const singles = (extras.singleSessionsLeft ?? 0) > 0;

  const open = phases.find((p) => p.state === "open");
  if (open) {
    const closes = open.registrationClosesAt ?? open.startsAt;
    const starts = `Starts ${day(open.startsAt, now)}`;
    if (open.placesLeft !== null && open.placesLeft <= FEW_PLACES) {
      return { tone: "urgent", label: `${starts} · only ${open.placesLeft} place${open.placesLeft === 1 ? "" : "s"} left` };
    }
    if (+new Date(closes) - now <= CLOSING_SOON_DAYS * DAY_MS) {
      return { tone: "urgent", label: `${starts} · registration closes ${inDays(closes, now)}` };
    }
    return { tone: "live", label: `Registration open · starts ${day(open.startsAt, now)}` };
  }

  const upcoming = phases.find((p) => p.state === "upcoming");
  if (upcoming) {
    return {
      tone: "live",
      label: `Registration opens ${day(upcoming.registrationOpensAt, now)} · starts ${day(upcoming.startsAt, now)}`,
    };
  }

  const full = phases.find((p) => p.state === "full");
  if (full) return { tone: "quiet", label: `Fully booked · starts ${day(full.startsAt, now)}` };

  // Registration for the series has closed ahead of its start: its sessions
  // are sold singly, while any has a seat.
  const closedEarly = phases.find((p) => p.state === "sessions");
  if (closedEarly) {
    return singles
      ? { tone: "live", label: `Single sessions on sale · starts ${day(closedEarly.startsAt, now)}` }
      : { tone: "closed", label: `Closed · starts ${day(closedEarly.startsAt, now)}` };
  }

  // Under way. Said in the same words whenever it is so (owner, 2026-10-09):
  // "In progress · single sessions on sale" while a session can still be
  // bought, and plainly "closed" when nothing can.
  const running = phases.find((p) => p.state === "in_progress");
  if (running) {
    return singles
      ? { tone: "live", label: "In progress · single sessions on sale" }
      : { tone: "closed", label: "In progress · closed" };
  }

  return { tone: "quiet", label: "Dates to be announced" };
}

/** The status of something with one date of its own: a retreat. */
export function datedStatus(item: {
  startsAt: string | null;
  endsAt: string | null;
  inProgress: boolean;
  /** Every batch over and none to come (owner, 2026-10-23). */
  endedAt?: string | null;
}): OfferStatus {
  const now = Date.now();
  if (item.inProgress) return { tone: "closed", label: "In progress · booking closed" };
  if (!item.startsAt && item.endedAt) return { tone: "closed", label: "Finished · next date to be announced" };
  if (!item.startsAt) return { tone: "quiet", label: "Date to be announced" };
  return +new Date(item.startsAt) - now <= CLOSING_SOON_DAYS * DAY_MS
    ? { tone: "urgent", label: `Starts ${day(item.startsAt, now)} · ${inDays(item.startsAt, now)}` }
    : { tone: "live", label: `Starts ${day(item.startsAt, now)}` };
}
