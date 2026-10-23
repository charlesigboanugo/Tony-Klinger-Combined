"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";

import { addToCartAction, removeFromCartAction } from "@/app/(public)/cart/actions";
import { announceVisitorChange, useVisitor } from "@/components/navigation/useVisitor";
import { ButtonLink, OUTLINE_STATES } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Add an item to the cart — note 09 §8.
 *
 * It posts only a SLUG and a billing period — never a price. The server
 * re-resolves both at checkout (note 09 §9), so a tampered form can change
 * which product is bought but never what it costs.
 *
 * ONCE IT IS IN THE CART, IT IS NOT OFFERED AGAIN (owner, 2026-10-08). The
 * button used to stay "Add to cart" for ever, and each press added another.
 * A product already in the cart now shows that it is, with "Remove" and a way
 * to the cart in the button's place. Where a different option of the same
 * offer is in the cart (one session, while the pack of eight is selected), the
 * button changes the cart to this one rather than adding a second line.
 *
 * The page is pre-built and cannot know the cart (note 10 §47.1), so what is
 * in it is asked after load, from the same `/api/session` the header's badge
 * uses. Until the answer arrives the plain button shows; the server action
 * refuses a duplicate regardless, so an early press cannot add one twice.
 *
 * Paired with a direct "buy now" link, because the two intents are different:
 * one customer is assembling a basket, another wants this one thing now.
 */
const OUTLINE = cn(
  "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6",
  "border border-input-border bg-transparent text-[0.9375rem] font-semibold text-foreground",
  "transition-[transform,box-shadow,background-color,border-color,color] duration-(--dur-fast) ease-expo",
  OUTLINE_STATES,
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  "active:scale-96 disabled:pointer-events-none disabled:opacity-50",
  "motion-reduce:transform-none motion-reduce:transition-none",
);

function AddButton({ label, block }: { label: string; block: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(OUTLINE, block && "w-full")}>
      {pending ? "Updating…" : label}
    </button>
  );
}

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-error disabled:opacity-50"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function AddToCart({
  slug,
  billing,
  buyNowHref,
  label = "Add to cart",
  siblings,
  block = false,
  className,
}: {
  /** The PRODUCT slug. Never an entity slug — the cart resolves products. */
  slug: string;
  billing?: "monthly" | "yearly";
  /** Where "Buy now" goes. Omitted when only the cart route makes sense. */
  buyNowHref?: string;
  label?: string;
  /**
   * The other options of the same offer (product slugs). When one of them is
   * in the cart, adding this one replaces it, and the button says so.
   */
  siblings?: string[];
  /** Fill the width of a purchase panel. */
  block?: boolean;
  className?: string;
}) {
  const inCart = useVisitor(usePathname())?.cartSlugs ?? [];
  const here = inCart.includes(slug);
  const other = !here && (siblings ?? []).some((s) => s !== slug && inCart.includes(s));

  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {buyNowHref ? (
        <ButtonLink href={buyNowHref} size="md">
          Buy now
        </ButtonLink>
      ) : null}

      {here ? (
        <div
          role="status"
          className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-(--radius) border border-success/40 bg-success/10 px-4 py-2"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-success">
            <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.5 8.5 6.5 11.5 12.5 5" />
            </svg>
            In your cart
          </span>
          <span className="flex items-center gap-4">
            <Link href="/cart" className="text-sm font-medium underline underline-offset-4 hover:text-accent">
              View cart
            </Link>
            <form
              action={async (formData) => {
                await removeFromCartAction(formData);
                announceVisitorChange();
              }}
            >
              <input type="hidden" name="slug" value={slug} />
              <RemoveButton />
            </form>
          </span>
        </div>
      ) : (
        <form
          className={cn(block && "w-full")}
          action={async (formData) => {
            await addToCartAction(formData);
            announceVisitorChange();
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          {billing ? <input type="hidden" name="billing" value={billing} /> : null}
          <AddButton block={block} label={other ? "Change your cart to this" : label} />
        </form>
      )}
    </div>
  );
}
