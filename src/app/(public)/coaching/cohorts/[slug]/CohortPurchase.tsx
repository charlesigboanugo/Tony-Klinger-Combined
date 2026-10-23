"use client";

import { useEffect, useState } from "react";

import { viewerSaleStatusAction } from "@/app/(public)/coaching/actions";
import { AddToCart } from "@/components/coaching/AddToCart";
import { NewsletterCta } from "@/components/content/NewsletterPopup";
import { ButtonLink } from "@/components/ui/Button";
import { toSaleStatus, type SaleStatus } from "@/lib/commerce/sale-status";

/**
 * A cohort's purchase step, for whoever is looking — migration 0017.
 *
 * Whether a cohort can be joined is decided by its INTAKES. The page is
 * pre-built (note 10 §47.1), so it renders what the public facts say
 * (`initial`: an intake open, full, coming, under way, or none) and corrects
 * itself once the visitor's own answer arrives: they are already on an intake,
 * or have paid for a place and not yet chosen one.
 *
 * Nothing is authorized here. Checkout asks the database the same question.
 */
export function CohortPurchase({
  productSlug,
  level,
  initial,
  opensOn,
}: {
  /** Null when the cohort has no active product, and so cannot be bought online. */
  productSlug: string | null;
  /** "Silver", for the button. */
  level: string;
  initial: SaleStatus;
  /** When registration opens, for an intake that is coming. Already formatted. */
  opensOn?: string | null;
}) {
  const [status, setStatus] = useState<SaleStatus>(initial);

  useEffect(() => {
    if (!productSlug) return;
    let live = true;
    viewerSaleStatusAction([productSlug])
      .then((s) => {
        if (live && s[productSlug]) setStatus(toSaleStatus(s[productSlug]));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [productSlug]);

  if (status === "ok" && productSlug) {
    return (
      <>
        <ButtonLink href={`/checkout?product=${productSlug}`} size="lg" className="w-full">
          Join the {level} cohort
        </ButtonLink>
        <AddToCart slug={productSlug} block className="mt-3" />
      </>
    );
  }

  if (status === "owned" || status === "unused") {
    return (
      <div className="rounded-(--radius) border border-success bg-success/10 p-5">
        <p className="font-medium text-success">{status === "owned" ? "You have a place" : "You have paid for a place"}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {status === "owned"
            ? "Your workshops, joining links and recordings are in your Academy."
            : "Choose your intake in your Academy and your place is kept in every workshop."}
        </p>
        <div className="mt-4">
          <ButtonLink href="/academy/cohorts">Go to your Academy</ButtonLink>
        </div>
      </div>
    );
  }

  const messages: Record<string, { title: string; body: string }> = {
    unscheduled: {
      title: "Dates to be announced",
      body: "Places go on sale when the next intake's dates are set. Tony's letters carry the news first.",
    },
    closed: {
      title: opensOn ? `Registration opens ${opensOn}` : "Registration is not open yet",
      body: "You can join from that date until the intake starts.",
    },
    ended: {
      title: "Intake finished",
      body: "Every intake so far has finished. The next one will be listed here when its dates are set.",
    },
    past: {
      title: "In progress",
      body: "This intake has begun and is closed to new people: it is one group, start to finish. The next intake will be listed here when its dates are set.",
    },
    full: {
      title: "Fully booked",
      body: "Every place on this intake has been taken. If another intake opens, it will be listed here.",
    },
    application: { title: "Not open for booking", body: "This cohort is not available to book just now." },
    unavailable: { title: "Not open for booking", body: "This cohort is not available to book just now." },
  };
  const m = messages[status] ?? messages.unavailable;

  return (
    <div>
      <p className="font-display text-2xl font-semibold">{m.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
      <div className="mt-5">
        <NewsletterCta variant="primary" />
      </div>
    </div>
  );
}
