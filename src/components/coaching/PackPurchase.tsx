"use client";

import { useEffect, useState } from "react";

import { viewerOneToOneDiscountAction, viewerSaleStatusAction } from "@/app/(public)/coaching/actions";
import { AddToCart } from "@/components/coaching/AddToCart";
import { OptionSwitch } from "@/components/coaching/OptionSwitch";
import { ButtonLink } from "@/components/ui/Button";
import { discounted, formatPrice } from "@/lib/commerce/pricing";
import { saleBlock, toSaleStatus } from "@/lib/commerce/sale-status";
import { cn } from "@/lib/utils/cn";

/**
 * Choose one session or a pack, then buy — note 07 §14, migration 0012.
 *
 * ONE PANEL FOR BOTH (owner, 2026-10-08: "make it easy to select or switch").
 * Before this a series page led with the eight-session price and tucked "or
 * one session" underneath as a second, smaller purchase; the two ways to buy
 * the same seat looked like two different things. Now the choice is the first
 * control in the panel, and the price, the per-session figure, the validity
 * and both buttons all follow it.
 *
 * Everything shown is passed in already formatted by the server page: this
 * component chooses between options, it never prices one (note 09 §9). The
 * slug it sends to checkout or the cart is re-priced there.
 */
export type PackOption = {
  /** Product slug. */
  slug: string;
  /** On the switch: "1 session", "8 sessions". */
  label: string;
  /** The product's name, for a message about it: "Writing — 8 Sessions". */
  name?: string;
  /** The price, formatted: "£130". */
  price: string;
  /** Beside the price: "for 8 sessions", "a session". */
  priceNote: string;
  /** Under the price, quieter: "£16.25 a session · Use within three months". */
  detail?: string | null;
  /** Beside the price, for a pack cheaper than its sessions bought singly: "Save £200". */
  saving?: string | null;
  /** The main button. A link, because the next step is another page. */
  cta: { href: string; label: string };
  /** Offer "Add to cart" as well. Off where the next step is choosing a time. */
  cart: boolean;
  /**
   * Dates this option is bought for (migration 0022: one Group Coaching
   * session is bought for a date). The buyer picks one here and it travels to
   * checkout as `session`; with none left to pick there is nothing to buy.
   */
  dates?: Array<{ id: string; label: string; note: string; full: boolean }>;
  /**
   * A pass holder's discount applies (a single one-to-one session, migration
   * 0026). With `amount`, a holder is shown their price; checkout charges it.
   */
  passDiscountable?: boolean;
  amount?: number;
  currency?: string;
};

export function PackPurchase({
  label,
  options,
  initial,
  passPerk = null,
}: {
  /** What is being chosen, for assistive tech. */
  label: string;
  options: PackOption[];
  /** Slug selected to begin with. Defaults to the first option. */
  initial?: string;
  /** "Pass holders save up to 15%", shown to everyone else on a discountable choice. */
  passPerk?: string | null;
}) {
  const opensOn = initial && options.some((o) => o.slug === initial) ? initial : options[0]?.slug;
  const [slug, setSlug] = useState(opensOn);
  // "#buy-<slug>" (the hero's saving chip) chooses that option and brings
  // the panel into view. Read in the browser: the page is pre-built.
  const slugs = options.map((o) => o.slug).join(",");
  useEffect(() => {
    const show = (hash: string) => {
      const wanted = hash.replace(/^#buy-/, "");
      if (wanted === hash || !slugs.split(",").includes(wanted)) return false;
      setSlug(wanted);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("buy")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      return true;
    };
    // A click on a "#buy-<slug>" link is handled here, not left to the
    // browser: when the address already carries that hash nothing changes,
    // so no hashchange would come and the panel would not scroll. This way
    // every click scrolls (owner, 2026-10-29).
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#buy-"]');
      const hash = link?.getAttribute("href");
      if (!hash || !show(hash)) return;
      e.preventDefault();
      const { pathname, search } = window.location;
      window.history.replaceState(window.history.state, "", `${pathname}${search}${hash}`);
    };
    const fromHash = () => show(window.location.hash);
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, [slugs]);

  // Choosing on the switch keeps the address in step: "#buy-<slug>" for any
  // other choice, and the plain address again for the one the page opens on,
  // so a link copied or reloaded shows what was chosen. replaceState: no
  // scroll, no history entry per click, and no hashchange back into the above.
  const choose = (next: string) => {
    setSlug(next);
    const { pathname, search } = window.location;
    window.history.replaceState(window.history.state, "", next === opensOn ? `${pathname}${search}` : `${pathname}${search}#buy-${next}`);
  };
  // Which of these the visitor may not buy just now. Asked after load, since
  // the page is pre-built; checkout enforces it whatever this says.
  const [status, setStatus] = useState<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    viewerSaleStatusAction(slugs.split(","))
      .then((s) => {
        if (live) setStatus(s);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [slugs]);

  // This visitor's own pass holder discount, asked after load (the page is
  // pre-built) and only where a choice can take it. Display only: checkout
  // prices it again from the session.
  const discountable = options.some((o) => o.passDiscountable);
  const [myPercent, setMyPercent] = useState(0);
  useEffect(() => {
    if (!discountable) return;
    let live = true;
    viewerOneToOneDiscountAction()
      .then((n) => {
        if (live) setMyPercent(n);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [discountable]);

  // The date chosen for an option that is bought for one. Starts on the first
  // with a seat, so the button is live without a second decision.
  const [date, setDate] = useState<string | null>(null);

  const selected = options.find((o) => o.slug === slug) ?? options[0];
  if (!selected) return null;

  const passPrice =
    selected.passDiscountable && myPercent > 0 && selected.amount != null
      ? formatPrice(discounted(selected.amount, myPercent), selected.currency)
      : null;
  // What leads the line under the price: a pack's saving, a holder's own
  // discount, or the passes' offer to everyone else.
  const badge = selected.saving
    ? { text: selected.saving, href: null }
    : passPrice
      ? { text: `${myPercent}% off with your pass`, href: null }
      : selected.passDiscountable && passPerk
        ? { text: passPerk, href: "/coaching/passes" }
        : null;
  const anyBadge = options.some((o) => o.saving || (o.passDiscountable && (passPerk || myPercent > 0)));

  const dates = selected.dates ?? null;
  const chosenDate = dates ? (dates.find((d) => d.id === date && !d.full) ?? dates.find((d) => !d.full) ?? null) : null;

  // Why this option cannot be bought just now, if it cannot: paid for and not
  // yet used, already theirs, registration closed, full. Only where the button
  // would take payment (`cart`): an option whose next step is choosing a time
  // uses what is held there instead.
  const block = selected.cart ? saleBlock(toSaleStatus(status[selected.slug]), selected.name ?? selected.label) : null;

  return (
    <div>
      {/* A switch with one side is noise: with a single way to buy, its name
          stands as a label instead. (A series and its single sessions are
          never on sale together — migration 0024.) */}
      {options.length > 1 ? (
        <OptionSwitch
          label={label}
          stretch
          onSelect={choose}
          options={options.map((o) => ({ value: o.slug, label: o.label, active: o.slug === selected.slug }))}
        />
      ) : (
        <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">{selected.label}</p>
      )}

      <p className={cn("flex items-baseline gap-2", options.length > 1 ? "mt-6" : "mt-3")}>
        {/* key on the slug so the figure is swapped, and the fade replays */}
        <span
          key={selected.slug}
          className="font-display text-5xl leading-none font-semibold tabular-nums motion-safe:animate-[nav-fade_var(--dur-base)_var(--ease-expo)]"
        >
          {passPrice ?? selected.price}
        </span>
        {passPrice ? <s className="text-lg text-muted-foreground tabular-nums">{selected.price}</s> : null}
        <span className="text-sm text-muted-foreground">{selected.priceNote}</span>
      </p>
      {/* The line is kept in both states so switching does not move the buttons.
          A pack's saving leads it, in the badge the pass billing switch uses. */}
      <p
        className={cn(
          "mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground",
          // Room for the badge's line in every state, where any choice has one.
          anyBadge ? "min-h-13 content-start" : "min-h-6",
        )}
      >
        {badge?.href ? (
          <a
            href={badge.href}
            className="rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap text-accent uppercase underline-offset-2 hover:underline"
          >
            {badge.text} &rarr;
          </a>
        ) : badge ? (
          <span className="rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-semibold tracking-wide whitespace-nowrap text-accent uppercase">
            {badge.text}
          </span>
        ) : null}
        <span>{selected.detail ?? ""}</span>
      </p>

      {block ? (
        <div className="mt-5 rounded-(--radius) border border-border bg-surface-muted/60 p-4">
          <p className="text-sm leading-relaxed">{block.message}</p>
          {block.href && block.action ? (
            <div className="mt-4">
              <ButtonLink href={block.href}>{block.action}</ButtonLink>
            </div>
          ) : null}
        </div>
      ) : dates ? (
        <>
          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Choose your date</legend>
            {/* A short list scrolls inside the panel, so eight dates do not
                push the button off the screen. */}
            <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
              {dates.map((d) => {
                const active = chosenDate?.id === d.id;
                return (
                  <label
                    key={d.id}
                    className={cn(
                      "flex items-center gap-3 rounded-(--radius) border p-3 text-sm transition-[border-color,background-color] duration-(--dur-fast)",
                      d.full
                        ? "border-border text-muted-foreground"
                        : active
                          ? "cursor-pointer border-primary bg-primary/8 ring-1 ring-primary/30"
                          : "cursor-pointer border-input-border hover:border-primary/50 hover:bg-surface-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="session-date"
                      value={d.id}
                      checked={active}
                      disabled={d.full}
                      onChange={() => setDate(d.id)}
                      className="size-4 shrink-0 accent-(--primary)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{d.label}</span>
                      <span className="block text-xs text-muted-foreground">{d.note}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          {chosenDate ? (
            <ButtonLink href={`${selected.cta.href}&session=${chosenDate.id}`} size="lg" className="mt-5 w-full">
              {selected.cta.label}
            </ButtonLink>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Every coming session is fully booked.</p>
          )}
        </>
      ) : (
        <ButtonLink href={selected.cta.href} size="lg" className="mt-5 w-full">
          {selected.cta.label}
        </ButtonLink>
      )}

      {selected.cart && !block ? (
        <AddToCart
          slug={selected.slug}
          siblings={options.map((o) => o.slug)}
          block
          className="mt-3"
        />
      ) : null}
    </div>
  );
}
