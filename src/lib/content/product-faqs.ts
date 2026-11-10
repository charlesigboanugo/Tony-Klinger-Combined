import type { Faq } from "@/components/content/FaqList";

/**
 * The questions on each product's page (owner, 2026-11-02, after the Coaching
 * Pass FAQ in `pass-faq.ts`): Group Coaching, Interactive Cohorts, private
 * coaching, courses, retreats and events.
 *
 * Every answer says what the site actually does: the rule it describes is
 * named beside it, and the figures that vary (prices, numbers of sessions,
 * how long sessions keep, which passes include what) are passed in from the
 * page's own data, so an answer cannot drift from the rule.
 *
 * Written to be easy to follow (owner, 2026-11-02): the answer first ("Yes",
 * "No", "For life"), then short sentences in everyday words, then what to do.
 *
 * An answer left `null` is waiting on Tony and is not shown until it is
 * written.
 */
type Draft = { question: string; answer: string | null };

const shown = (drafts: Draft[]): Faq[] => drafts.filter((d): d is Faq => Boolean(d.answer));
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const inWords = (n: number) => words[n] ?? String(n);
const listOf = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

/**
 * Tony's refund policy (2026-11-04), one answer for every product. It holds
 * because checkout says, by its button, that continuing agrees to it (migration
 * 0028), and the Terms say the same.
 */
export const REFUND_ANSWER =
  "Once your purchase is confirmed, payments are non-refundable: by continuing to payment at checkout, you ask for it to start straight away, which gives up the usual 14-day right to cancel. If we are unable to deliver our service as agreed, you get a full refund.";
const refunds: Draft = { question: "What if I change my mind?", answer: REFUND_ANSWER };

/** A Group Coaching series. Registration, single sessions and replays: migrations 0016, 0022, 0025. */
export function seriesFaqs(opts: { sessions: number; singlePrice: string | null; seriesPrice: string | null }): Faq[] {
  const { sessions, singlePrice, seriesPrice } = opts;
  return shown([
    {
      question: "How does a series work?",
      answer: `${inWords(sessions).replace(/^./, (c) => c.toUpperCase())} live sessions with Tony, held once a week online in a small group. Sign up once${seriesPrice ? ` (${seriesPrice})` : ""} and your place is kept for every session, so there's nothing to book each week.`,
    },
    {
      question: "Can I come to just one session?",
      answer: singlePrice
        ? `Yes, once sign-ups for the whole series have closed. Any places left are then sold individually at ${singlePrice} each, and you choose the date. Until then, only the full series is on sale, so the group starts together.`
        : "Yes, once sign-ups for the whole series have closed. Any places left are then sold individually.",
    },
    {
      question: "What if I miss a session?",
      answer: "You can watch the replay. If you've joined the series, every session's recording is in your Academy.",
    },
    {
      question: "Is a series included in the Coaching Pass?",
      answer: "Yes. Every Coaching Pass includes at least one series a year. Pass holders sign up in their Academy, before everyone else.",
    },
    {
      // FINAL (owner, 2026-11-02): a place on a series, or a single session
      // bought for its date (owner, 2026-10-09), is not swapped or cancelled,
      // online or by asking. Cancelling is only for one-to-ones and events.
      question: "Can I change or cancel my place?",
      answer: "No. Once you've signed up, your place is fixed. It can't be swapped for another series or date, or cancelled.",
    },
    refunds,
  ]);
}

/** An Interactive Cohort. Intakes, recordings and choosing an intake: migration 0017. */
export function cohortFaqs(): Faq[] {
  return shown([
    {
      question: "How is a cohort different from Group Coaching?",
      answer:
        "A cohort is a fixed programme with the same group from start to finish: eight three-hour workshops, live on Zoom. You pay once for your place, and there's nothing to book each week.",
    },
    {
      question: "What if I miss a workshop?",
      answer: "You can watch the recording. Every workshop is recorded and saved in your Academy.",
    },
    {
      question: "How do I choose my dates?",
      answer:
        "Buy while a group is open for sign-ups and you'll be added to it. If two groups are open at once, you choose between them in your Academy.",
    },
    {
      // FINAL (owner, 2026-11-02), as a series place is.
      question: "Can I change or cancel my place?",
      answer: "No. Once you've joined a group, your place is fixed. It can't be swapped for another group or cancelled.",
    },
    {
      question: "Is a cohort included in the Coaching Pass?",
      answer: "No. Cohorts are bought on their own, separately from the Coaching Pass.",
    },
    refunds,
  ]);
}

/** One-to-one coaching. One session: choose a time, then pay (0030); the pack: pay, then book (0012, 0020); the discount: 0026. */
export function privateCoachingFaqs(opts: {
  validMonths: number | null;
  pack: { sessions: number; saving: string | null; validMonths: number | null } | null;
  /** "5% off with Silver Pass, 10% off with Gold Pass…", or null where no pass gives one. */
  passDiscounts: string | null;
}): Faq[] {
  const { validMonths, pack, passDiscounts } = opts;
  return shown([
    {
      question: "How do I book a time?",
      answer: "For one session, pick a time from Tony's diary, then pay. The time is held for you while you pay and booked as soon as payment goes through. With a pack, you pay once and your sessions wait in your Academy, so you can pick a time for each one whenever you're ready.",
    },
    {
      question: "How long do I have to use my sessions?",
      answer: validMonths
        ? `${inWords(validMonths).replace(/^./, (c) => c.toUpperCase())} months from the date of purchase. You can book at any time within that period.`
        : "There's no time limit. Your sessions don't expire.",
    },
    {
      question: "Can I cancel or move a session?",
      answer: "Yes, up to 48 hours before it starts. Cancel it from your bookings and the session is returned to your account to rebook. After that, it counts as used.",
    },
    {
      question: "How do I join the session?",
      answer: "Online. Your joining link appears in your Academy 15 minutes before the session starts.",
    },
    ...(pack
      ? [
          {
            question: "Is it cheaper to buy a pack?",
            answer: `Yes. A pack of ${pack.sessions} sessions ${pack.saving ? `saves you ${pack.saving} compared with buying them individually` : "costs less than buying them individually"}. Use them whenever you like${pack.validMonths ? ` within ${inWords(pack.validMonths)} months` : ""}.`,
          },
        ]
      : []),
    ...(passDiscounts
      ? [
          {
            question: "Do Coaching Pass holders pay less?",
            answer: `Yes. When you buy a single session for yourself, you get ${passDiscounts}. The discount is applied at checkout when you're signed in.`,
          },
        ]
      : []),
    refunds,
  ]);
}

/** A self-paced course. Lifetime access, as the course page states. */
export function courseFaqs(): Faq[] {
  return shown([
    {
      question: "How long do I have access?",
      answer: "For life. Pay once and every lesson stays in your Academy, so you can work through it at your own pace, on any device.",
    },
    {
      question: "Do I need to take Level One before Level Two?",
      answer: "No. Each course stands alone, so start with whichever suits you best.",
    },
    {
      question: "Is a course included in the Coaching Pass?",
      answer: "No. Courses are bought on their own, separately from the Coaching Pass.",
    },
    refunds,
  ]);
}

/** A Virtual Retreat level. Dates, interviews and passes: migrations 0030, 0032. */
export function retreatFaqs(opts: {
  byInterview: boolean;
  /** This level is the one a pass gives free entry to (Level One). */
  passEntry: boolean;
  /** The passes that include free entry to Level One, by name. */
  passNames: string[];
}): Faq[] {
  const { byInterview, passEntry, passNames } = opts;
  const passes = listOf(passNames);
  return shown([
    {
      question: "What happens on the day?",
      answer: "It's one day, live online, with working mentors. What you do depends on the level. This page lists what's included.",
    },
    ...(byInterview
      ? [
          {
            question: "What does \"by interview\" mean?",
            answer:
              "You'll have a short interview with us first. Apply on this page and we'll arrange it. Once you're accepted, you can book your place.",
          },
        ]
      : []),
    {
      question: "Which date will I be booked on?",
      answer: byInterview
        ? "The date you were accepted for. All dates are listed on this page."
        : "The next date that's open and still has places. All dates are listed on this page.",
    },
    ...(passNames.length > 0
      ? [
          {
            question: "Is a retreat included in the Coaching Pass?",
            answer: passEntry
              ? `Yes. Level One is free with the ${passes}. Levels Two and Three are by interview and paid for separately, whichever pass you hold.`
              : `No. The ${passes} includes Level One only. This level is by interview and paid for separately, whichever pass you hold.`,
          },
        ]
      : []),
    refunds,
  ]);
}

/** An event. Tickets and free places: migrations 0017, 0018. */
export function eventFaqs(opts: { isFree: boolean; online: boolean }): Faq[] {
  const { isFree, online } = opts;
  return shown([
    {
      question: isFree ? "Do I need to register for a free event?" : "Do I need an account to buy a ticket?",
      answer: isFree
        ? "Yes, so we know you're coming. Your ticket is emailed to you and kept in your account."
        : "Yes, because each ticket is issued in your name. You can sign in, or create an account, as you buy. Your ticket is emailed to you and kept in your account.",
    },
    {
      question: online ? "How do I join on the day?" : "What do I bring on the day?",
      answer: online
        ? "Use the link on your ticket. You'll find it in your email and in your account."
        : "Just your ticket. Show its QR code, or its reference number, at the door.",
    },
    {
      question: "What if I can no longer come?",
      answer: isFree
        ? "[Let us know](/contact), so someone else can have your place. If we ever cancel an event, we'll tell you and offer another date if we can."
        : "Please [get in touch](/contact) about your ticket. If we ever cancel an event, we'll offer another date or your money back.",
    },
    ...(isFree ? [] : [refunds]),
  ]);
}

/** The retreats listing: every level at once, so the levels are told apart. */
export function retreatsOverviewFaqs(opts: { passNames: string[] }): Faq[] {
  const passes = listOf(opts.passNames);
  return shown([
    {
      question: "What happens on the day?",
      answer: "Each retreat is one day, live online, with working mentors. What you do depends on the level you choose.",
    },
    {
      question: "How do the levels differ?",
      answer:
        "Level One is open to anyone: watch the mentors at work and ask your questions. Levels Two and Three start with a short interview. Level Two adds feedback on your own project, and Level Three lets you pitch it to the full panel.",
    },
    {
      question: "Which date will I be booked on?",
      answer:
        "Level One: the next date that's open and still has places. Levels Two and Three: the date you were accepted for. Each level's page lists its dates.",
    },
    ...(opts.passNames.length > 0
      ? [
          {
            question: "Is a retreat included in the Coaching Pass?",
            answer: `Partly. Level One is free with the ${passes}. Levels Two and Three are by interview and paid for separately, whichever pass you hold.`,
          },
        ]
      : []),
    refunds,
  ]);
}

/** The events listing: free and ticketed events alike, as each event's page states. */
export function eventsOverviewFaqs(): Faq[] {
  return shown([
    {
      question: "How do I get a place?",
      answer:
        "On the event's page. Register for a free event, or buy a ticket for a paid one. Your ticket is emailed to you and kept in your account.",
    },
    {
      question: "How do I join or get in?",
      answer: "Online: use the link on your ticket. In person: show your ticket's QR code, or its reference number, at the door.",
    },
    {
      question: "What if I can no longer come?",
      answer: "Please [get in touch](/contact) about your ticket. If we ever cancel an event, we'll offer another date or your money back.",
    },
    {
      question: "Can Tony speak at my event?",
      answer: "Yes. To bring Tony to your own audience, please [get in touch](/contact).",
    },
    refunds,
  ]);
}
