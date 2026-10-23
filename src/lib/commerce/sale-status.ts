/**
 * `coaching_sale_status` answers, worded for the person trying to buy —
 * migration 0012, note 09 §28.1.
 *
 * One wording, used by checkout (which refuses the sale), the checkout and cart
 * pages (which say so before the button is pressed) and the product pages. Not
 * `server-only`: the product pages' purchase panels are client components.
 */
export type SaleStatus =
  | "ok"
  | "owned"
  | "unused"
  | "closed"
  | "full"
  | "unscheduled"
  | "ended"
  | "past"
  | "application"
  | "unavailable";

const STATUSES: readonly string[] = ["ok", "owned", "unused", "closed", "full", "unscheduled", "ended", "past", "application", "unavailable"];

export function toSaleStatus(value: unknown): SaleStatus {
  return typeof value === "string" && STATUSES.includes(value) ? (value as SaleStatus) : "ok";
}

/** Why this cannot be bought now, or null when it can. */
export function saleBlock(status: SaleStatus, name: string): { message: string; href?: string; action?: string } | null {
  switch (status) {
    case "ok":
      return null;
    case "owned":
      return {
        message: `You already have ${name}. There is nothing more to pay.`,
        href: "/academy",
        action: "Go to your Academy",
      };
    case "unused":
      return {
        message:
          "You have already paid for this and not used it yet. You can buy more once it is used or has expired, whichever comes first.",
        href: "/academy/coaching",
        action: "Use it in your Academy",
      };
    case "closed":
      return {
        message: `Registration for ${name} is not open at the moment. It opens ahead of the start date and closes on the date shown on its page.`,
      };
    case "full":
      return { message: `${name} is fully booked.` };
    case "unscheduled":
      return { message: `${name} has no dates yet. It goes on sale when they are announced.` };
    case "ended":
      // Every date has passed (migration 0022). It used to fall under
      // "no date yet", which read as though nothing had ever been planned.
      return { message: `${name} has finished. New dates are announced on its page when they are set.` };
    case "past":
      return { message: `${name} has already started.` };
    case "application":
      return {
        message: `${name} is by interview. Please apply first. You will be able to book as soon as you are accepted.`,
        href: "/contact",
        action: "Apply",
      };
    case "unavailable":
      return { message: `${name} is not available to buy just now.` };
  }
}
