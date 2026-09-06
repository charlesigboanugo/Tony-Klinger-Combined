import type { Metadata } from "next";

import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default function CheckoutCancelPage() {
  return (
    <div className="space-y-6 py-10 text-center">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Nothing charged
      </p>
      <h1 className="font-display text-3xl font-semibold text-balance sm:text-4xl">
        Checkout cancelled
      </h1>
      <p className="mx-auto max-w-md text-pretty text-muted-foreground">
        Nothing has been charged. Your order was saved as unpaid, so you can
        pick up where you left off whenever you like.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/cart">Back to your cart</ButtonLink>
        <ButtonLink href="/coaching" variant="outline">
          Back to coaching
        </ButtonLink>
        <ButtonLink href="/contact" variant="ghost">
          Get help
        </ButtonLink>
      </div>
    </div>
  );
}
