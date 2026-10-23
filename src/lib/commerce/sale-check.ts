import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { UPGRADE_MIN_MONTHS } from "@/lib/commerce/pass-upgrade";
import { saleBlock, toSaleStatus } from "@/lib/commerce/sale-status";

/**
 * Can this line be sold to the person asking, now? — note 09 §28.1.
 *
 * One question, asked by the cart, the checkout page and the checkout action,
 * so the three cannot disagree. Coaching products are answered by the database
 * (`coaching_sale_status`); membership is answered here.
 *
 * MEMBERSHIP IS ONE PAYMENT FOR TWELVE MONTHS (owner, 2026-10-09). Somebody who
 * holds one cannot pay for the same tier, or a lower one, a second time while
 * more than thirty days of it remain: the second payment would buy nothing they
 * do not have. Inside the last thirty days they may, and the new year is added
 * to the end of the one they hold (`grant_entitlements_for_order`). A higher
 * tier is an UPGRADE: the difference in price, while four months remain.
 */
export const RENEWAL_WINDOW_DAYS = 30;

type Line = {
  productId: string;
  productType: string;
  name: string;
  needsDate?: boolean;
  seriesId?: string | null;
  sessionId?: string | null;
  /** Set where the line is a pass upgrade (`applyPassUpgrades`). */
  upgradeFrom?: string | null;
};
type Block = NonNullable<ReturnType<typeof saleBlock>>;

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

async function membershipBlock(supabase: SupabaseClient, line: Line): Promise<Block | null> {
  const { data: current } = await supabase.rpc("my_membership");
  const held = (
    current as Array<{ tier_name: string; rank: number; source_type: string; expires_at: string | null }> | null
  )?.[0];
  if (!held) return null;

  // A membership still renewing as a subscription has to be cancelled first,
  // or it would go on being charged alongside the year just paid for.
  if (held.source_type === "membership") {
    return {
      message: `You have a ${held.tier_name} that renews. Cancel it first, and you can buy a pass for the year once it has ended.`,
      href: "/account/billing",
      action: "Go to billing",
    };
  }

  const { data: tier } = await supabase
    .from("membership_tiers")
    .select("rank")
    .eq("product_id", line.productId)
    .maybeSingle();
  const rank = (tier as { rank: number } | null)?.rank ?? 0;

  // A HIGHER TIER is bought as an upgrade, for the difference, while at least
  // four months of the pass remain (migration 0027; `applyPassUpgrades` marks
  // the line). After that it waits for the renewal window like any other.
  if (rank > held.rank && line.upgradeFrom) return null;

  if (!held.expires_at) {
    return { message: `You already have a ${held.tier_name}.`, href: "/academy/pass", action: "Go to your pass" };
  }
  const ends = new Date(held.expires_at);
  const opens = new Date(ends.getTime() - RENEWAL_WINDOW_DAYS * 86_400_000);
  if (Date.now() >= opens.getTime()) return null;

  if (rank > held.rank) {
    return {
      message: `A pass can be moved up while at least ${UPGRADE_MIN_MONTHS} months of it remain. Your ${held.tier_name} runs until ${day(ends)}, so you can buy ${line.name} from ${day(opens)}, when it can be renewed.`,
      href: "/academy/pass",
      action: "Go to your pass",
    };
  }

  return {
    message: `You already have a ${held.tier_name}, which runs until ${day(ends)}. You can buy another year from ${day(opens)}.`,
    href: "/academy/pass",
    action: "Go to your pass",
  };
}

/**
 * One Group Coaching session is bought for a date (migration 0022): the date
 * has to be named, be a session of that series, and still have a seat.
 */
async function datedSessionBlock(supabase: SupabaseClient, line: Line): Promise<Block | null> {
  const chooser = { href: "/coaching/group-coaching", action: "Choose a date" };
  if (!line.sessionId || !UUID.test(line.sessionId)) {
    return { message: `${line.name} is bought for a date. Choose one on the series page.`, ...chooser };
  }

  const { data: coming } = await supabase.rpc("coming_sessions", { p_series_id: line.seriesId ?? "" });
  const session = ((coming ?? []) as Array<{ id: string }>).find((s) => s.id === line.sessionId);
  if (!session) {
    return { message: "That session is no longer on sale. Please choose another date.", ...chooser };
  }

  const { data: status } = await supabase.rpc("session_sale_status", { p_session_id: line.sessionId });
  switch (status) {
    case "ok":
      return null;
    case "owned":
      return {
        message: "You already have a seat in that session. There is nothing more to pay.",
        href: "/academy/coaching",
        action: "Go to your Academy",
      };
    case "full":
      return { message: "That session is now fully booked. Please choose another date.", ...chooser };
    default:
      return { message: "That session is no longer on sale. Please choose another date.", ...chooser };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Why this line cannot be bought now, or null when it can. */
export async function saleCheck(supabase: SupabaseClient, line: Line): Promise<Block | null> {
  if (line.productType === "membership") return membershipBlock(supabase, line);
  const { data } = await supabase.rpc("coaching_sale_status", { p_product_id: line.productId });
  // Single sessions are sold once their series has started (migration 0024);
  // "registration is not open" is the series' wording, and wrong for them.
  if (line.needsDate && data === "closed") {
    return {
      message: `Single sessions go on sale once registration for the series has closed. Until then it is sold as the full series.`,
      href: "/coaching/group-coaching",
      action: "See the series",
    };
  }
  const block = saleBlock(toSaleStatus(data), line.name);
  if (block || !line.needsDate) return block;
  return datedSessionBlock(supabase, line);
}
