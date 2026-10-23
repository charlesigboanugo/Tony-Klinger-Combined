/**
 * Buying for someone else — owner, 2026-10-15; note 05 §29.2.
 *
 * A gift is a guest order made out to the recipient's email. They add it to
 * their account with the emailed link, or from their account once signed in
 * with that email, the same as any purchase made without signing in.
 *
 * Only what can sit waiting in somebody's account can be a gift. A ticket or a
 * dated seat is issued in a name at the point of sale, a subscription bills
 * the account it belongs to, and a cohort or retreat place depends on the
 * person's own level or application — none of those can be bought blind for
 * another person.
 */

type GiftLine = {
  name: string;
  productType: string;
  billingType?: string | null;
  needsDate?: boolean;
};

const NOT_GIFTABLE: Record<string, string> = {
  event: "is a ticket issued in the holder's own name",
  cohort: "depends on the person's own level",
  retreat: "depends on the person's own application",
};

/** Why these lines cannot be bought as a gift, or null when they can. */
export function giftBlock(lines: GiftLine[]): string | null {
  for (const line of lines) {
    const reason = NOT_GIFTABLE[line.productType];
    if (reason) return `${line.name} can't be bought as a gift: it ${reason}.`;
    if (line.billingType === "recurring") {
      return `${line.name} renews on the buyer's account, so it can't be bought as a gift.`;
    }
    if (line.needsDate) {
      return `${line.name} is a seat on a set date, so it can't be bought as a gift. A pack of sessions can.`;
    }
  }
  return null;
}
