"use client";

import { useEffect, useState } from "react";

import { viewerSaleStatusAction } from "@/app/(public)/coaching/actions";
import { AddToCart } from "@/components/coaching/AddToCart";
import { OptionSwitch } from "@/components/coaching/OptionSwitch";
import { ButtonLink } from "@/components/ui/Button";
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
};

export function PackPurchase({
  label,
  options,
  initial,
}: {
  /** What is being chosen, for assistive tech. */
  label: string;
  options: PackOption[];
  /** Slug selected to begin with. Defaults to the first option. */
  initial?: string;
}) {
  const [slug, setSlug] = useState(initial && options.some((o) => o.slug === initial) ? initial : options[0]?.slug);
  // Which of these the visitor may not buy just now. Asked after load, since
  // the page is pre-built; checkout enforces it whatever this says.
  const [status, setStatus] = useState<Record<string, string>>({});
  const slugs = options.map((o) => o.slug).join(",");
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

  // The date chosen for an option that is bought for one. Starts on the first
  // with a seat, so the button is live without a second decision.
  const [date, setDate] = useState<string | null>(null);

  const selected = options.find((o) => o.slug === slug) ?? options[0];
  if (!selected) return null;

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
          onSelect={setSlug}
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
          {selected.price}
        </span>
        <span className="text-sm text-muted-foreground">{selected.priceNote}</span>
      </p>
      {/* The line is kept in both states so switching does not move the buttons. */}
      <p className="mt-2 min-h-5 text-sm text-muted-foreground">{selected.detail ?? ""}</p>

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
