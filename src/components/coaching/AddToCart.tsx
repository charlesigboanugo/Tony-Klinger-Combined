"use client";

import { useFormStatus } from "react-dom";

import { addToCartAction } from "@/app/(public)/cart/actions";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

/**
 * Add an item to the cart — note 09 §8.
 *
 * THIS CONTROL DID NOT EXIST. `addToCartAction` was implemented and wired to
 * the cart, but nothing anywhere rendered it, so no item could ever be added:
 * the cart was permanently empty, and the whole cart → checkout path was
 * unreachable. This is the missing half.
 *
 * It posts only a SLUG and a billing period — never a price. The server
 * re-resolves both at checkout (note 09 §9), so a tampered form can change
 * which product is bought but never what it costs.
 *
 * Paired with a direct "buy now" link, because the two intents are different:
 * one customer is assembling a basket, another wants this one thing now, and
 * making the second walk through the cart loses sales for no benefit.
 */
function AddButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-6",
        "border border-input-border bg-transparent text-[0.9375rem] font-semibold text-foreground",
        "transition-[transform,box-shadow,background-color,border-color,color] duration-(--dur-fast) ease-expo",
        "hover:border-primary hover:bg-primary/8 hover:text-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
        "motion-reduce:transform-none motion-reduce:transition-none",
      )}
    >
      {pending ? "Adding…" : label}
    </button>
  );
}

export function AddToCart({
  slug,
  billing,
  buyNowHref,
  label = "Add to cart",
  className,
}: {
  /** The PRODUCT slug. Never an entity slug — the cart resolves products. */
  slug: string;
  billing?: "monthly" | "yearly";
  /** Where "Buy now" goes. Omitted when only the cart route makes sense. */
  buyNowHref?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {buyNowHref ? (
        <ButtonLink href={buyNowHref} size="md">
          Buy now
        </ButtonLink>
      ) : null}

      <form action={addToCartAction}>
        <input type="hidden" name="slug" value={slug} />
        {billing ? <input type="hidden" name="billing" value={billing} /> : null}
        <AddButton label={label} />
      </form>
    </div>
  );
}
