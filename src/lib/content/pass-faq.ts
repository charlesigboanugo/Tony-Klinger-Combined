import type { Faq } from "@/components/content/FaqList";
import { UPGRADE_MIN_MONTHS } from "@/lib/commerce/pass-upgrade";
import { RENEWAL_WINDOW_DAYS } from "@/lib/commerce/sale-check";
import type { MembershipTier } from "@/lib/content/coaching";
import { REFUND_ANSWER } from "@/lib/content/product-faqs";

/**
 * The Coaching Pass questions (owner, 2026-11-02, from Elaine's review), shown
 * on the passes page and on each pass's page.
 *
 * Every answer says what the site actually does, and the figures are read from
 * where the rules live (the upgrade and renewal windows, each pass's one-to-one
 * discount), so an answer cannot drift from the rule it describes.
 *
 * Written to be easy to follow (owner, same day): the answer first ("Yes",
 * "The day you buy it"), then short sentences in everyday words, then what to do.
 *
 * An answer left `null` is a question still waiting on Tony: it is kept here
 * so it is not forgotten, and not shown until it is answered.
 */
type Draft = { question: string; answer: string | null };

const words = ["no", "one", "two", "three", "four", "five", "six"];

export function passFaqs(tiers: MembershipTier[]): Faq[] {
  const onSale = tiers.filter((t) => t.prices.length > 0);
  const discounts = onSale.filter((t) => t.oneToOneDiscount > 0);
  const listOf = (items: string[]) =>
    items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

  const drafts: Draft[] = [
    {
      question: "When do my twelve months start?",
      answer: "Your pass starts the day you buy it and lasts twelve months.",
    },
    {
      question: "How do I choose my Group Coaching series?",
      answer:
        "Sign up in your Academy when a series opens. Pass holders can sign up before everyone else, and once you're in, your place is kept for every session, so there's nothing to book each week.",
    },
    {
      question: "What if a series I've chosen runs past the end of my year?",
      answer: "You still finish it. Any series you join during your year is yours to the end, even if your pass ends first.",
    },
    {
      question: "Do I keep the replays afterwards?",
      answer:
        "Yes, for your series. Replays of any series you joined stay in your Academy after your pass ends. Access to the video playlists and Q&A recordings ends with your pass.",
    },
    {
      question: "Can I move up to a higher pass during my year?",
      answer: `Yes. You pay only the difference in price, as long as at least ${words[UPGRADE_MIN_MONTHS] ?? UPGRADE_MIN_MONTHS} months of your pass remain. You get everything the higher pass includes straight away, and your end date stays the same.`,
    },
    {
      question: "What happens when my year ends?",
      answer: `It simply ends, and you won't be charged again. You can renew from ${RENEWAL_WINDOW_DAYS} days before the end, and your new year starts when the old one finishes. Once it has ended, you can buy a new pass at any time.`,
    },
    {
      question: "Can I change my chosen playlist?",
      // Final (owner, 2026-11-02): changes on request would let a Silver holder
      // work through every playlist, which is what Gold sells.
      answer: "No. If your pass lets you choose a playlist, your choice stays for the whole year, so take a moment over it.",
    },
    {
      question: "Can I buy a pass as a gift?",
      answer:
        "Yes. Choose \"Give it as a gift\" on the pass page. You pay, and we email the recipient a link to claim it.",
    },
    ...(discounts.length > 0
      ? [
          {
            question: "Do pass holders get money off one-to-one coaching?",
            answer: `Yes. When you buy a single one-to-one session for yourself, you get ${listOf(discounts.map((t) => `${t.oneToOneDiscount}% off with a ${t.name}`))}. The discount is applied at checkout when you're signed in.`,
          },
        ]
      : []),
    // Tony (2026-11-04): "The dates of all our events will be advised monthly in advance."
    {
      question: "When is the monthly Q&A held?",
      answer: "The date changes from month to month. We let you know each month's date in advance.",
    },
    // Tony's policy (2026-11-04), as the Terms and checkout state it.
    { question: "What is your refund policy?", answer: REFUND_ANSWER },
  ];

  return drafts.filter((d): d is Faq => Boolean(d.answer));
}
