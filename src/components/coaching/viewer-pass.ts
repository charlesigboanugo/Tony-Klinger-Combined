"use client";

import { useEffect, useState } from "react";

import { viewerPassAction, type ViewerPass } from "@/app/(public)/coaching/actions";

/**
 * What one pass tier is TO THIS VISITOR — owner, 2026-10-10.
 *
 * Somebody holding a Gold Pass was offered "Get Silver Pass" and "Get Gold
 * Pass", followed either to checkout, and was refused there. Each tier now
 * says where they stand before they press anything:
 *
 *   buy            no pass: the ordinary button
 *   current        the pass they hold: its end date and the way into it
 *   included       a lower tier than theirs: nothing to buy
 *   upgrade        a higher tier: move up for the difference in price, while
 *                  four months of their pass remain (migration 0027)
 *   later          a higher tier, with less than four months left: it waits
 *                  for the renewal window
 *   renew          the same or a lower tier, inside the last thirty days
 *   subscription   they hold a renewing pass: billing first
 */
export type PassOffer =
  | { kind: "buy" }
  | { kind: "upgrade"; label: string; note: string }
  | { kind: "renew"; label: string; note: string }
  | { kind: "current"; title: string; note: string; href: string; action: string }
  | { kind: "included"; title: string; note: string }
  | { kind: "later"; title: string; note: string }
  | { kind: "subscription"; title: string; note: string; href: string; action: string };

/** The visitor's pass, once the page has loaded. Null for none, or signed out. */
export function useViewerPass(): ViewerPass | null {
  const [pass, setPass] = useState<ViewerPass | null>(null);
  useEffect(() => {
    let live = true;
    viewerPassAction()
      .then((p) => {
        if (live) setPass(p);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return pass;
}

/** "Gold" from "Gold Pass": for a button, where the noun is already said. */
const short = (name: string) => name.replace(/\s+(Pass|Membership)$/i, "");

const money = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);

export function passOffer(
  pass: ViewerPass | null,
  tier: { name: string; rank: number; amount: number | null; currency: string },
): PassOffer {
  if (!pass) return { kind: "buy" };

  if (pass.subscription) {
    return {
      kind: "subscription",
      title: `You have a ${pass.tierName} that renews`,
      note: "Cancel it under Billing first; you can buy a pass for the year once it has ended.",
      href: "/account/billing",
      action: "Go to billing",
    };
  }

  if (tier.rank > pass.rank) {
    // Inside the renewal window a higher tier is simply the next year's pass.
    if (pass.renewable) {
      return { kind: "renew", label: `Get ${short(tier.name)}`, note: `It takes over when your ${pass.tierName} ends.` };
    }
    const difference = tier.amount !== null && pass.amount !== null ? tier.amount - pass.amount : null;
    if (pass.canUpgrade && difference !== null && difference > 0) {
      return {
        kind: "upgrade",
        label: `Upgrade for ${money(difference, tier.currency)}`,
        note: `The difference from your ${pass.tierName}. It becomes ${short(tier.name)} for the rest of its year${pass.endsOn ? `, until ${pass.endsOn}` : ""}, with everything ${short(tier.name)} adds.`,
      };
    }
    return {
      kind: "later",
      title: "Upgrades have closed for this year",
      note: `A pass can be moved up while at least four months of it remain.${pass.renewFrom ? ` You can buy ${tier.name} from ${pass.renewFrom}, when yours can be renewed.` : ""}`,
    };
  }

  if (pass.renewable) {
    return tier.rank === pass.rank
      ? { kind: "renew", label: "Renew for another year", note: "The new year is added to the end of the one you hold." }
      : { kind: "renew", label: `Get ${short(tier.name)}`, note: `It takes over when your ${pass.tierName} ends.` };
  }

  if (tier.rank === pass.rank) {
    return {
      kind: "current",
      title: "This is your pass",
      note: pass.endsOn
        ? `It runs until ${pass.endsOn}. You can renew it from ${pass.renewFrom}.`
        : "It has no end date.",
      href: "/academy/pass",
      action: "Open your pass",
    };
  }

  return {
    kind: "included",
    title: `Covered by your ${pass.tierName}`,
    note: `Your ${pass.tierName} already includes more than this tier.`,
  };
}
