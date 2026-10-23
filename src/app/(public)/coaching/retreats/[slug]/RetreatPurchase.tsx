"use client";

import { useEffect, useState } from "react";

import { retreatViewerAction, type RetreatViewerState } from "@/app/(public)/coaching/actions";
import { AddToCart } from "@/components/coaching/AddToCart";
import { RetreatApplication } from "@/app/(public)/coaching/retreats/[slug]/RetreatApplication";
import { NewsletterCta } from "@/components/content/NewsletterPopup";
import { ButtonLink } from "@/components/ui/Button";

/**
 * The retreat's purchase step, for whoever is looking — migration 0012.
 *
 * The page is pre-built and the same for everyone (note 10 §47.1), so it
 * renders what the public facts alone say (`initial`: no date yet, by
 * interview, or open) and corrects itself once the visitor's own answer
 * arrives: they already have a place, their application was approved, or the
 * last place has gone.
 *
 * Nothing is authorized here. Checkout asks the database the same question
 * before it will create an order.
 */
export type SaleState = "ok" | "full" | "unscheduled" | "ended" | "past" | "application" | "closed" | "unavailable";

export function RetreatPurchase({
  retreatId,
  productId,
  productSlug,
  name,
  slug,
  initial,
}: {
  retreatId: string;
  productId: string | null;
  /** Null when the level has no active product, and so cannot be bought online. */
  productSlug: string | null;
  name: string;
  /** The retreat page's own slug, to come back to after signing in. */
  slug: string;
  initial: SaleState;
}) {
  const [viewer, setViewer] = useState<RetreatViewerState | null>(null);

  useEffect(() => {
    let live = true;
    retreatViewerAction(retreatId, productId)
      .then((v) => {
        if (live) setViewer(v);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [retreatId, productId]);

  if (viewer?.entitled) {
    return (
      <div className="rounded-(--radius) border border-success bg-success/10 p-5">
        <p className="font-medium text-success">You have a place</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The date and your joining link will be in your Academy, and we will email you as soon as the date is set.
        </p>
        <div className="mt-4">
          <ButtonLink href="/academy/coaching">Go to your Academy</ButtonLink>
        </div>
      </div>
    );
  }

  const sale = (viewer?.sale as SaleState | null) ?? initial;

  if (sale === "ok" && productSlug) {
    return (
      <>
        <ButtonLink href={`/checkout?product=${productSlug}`} size="lg" className="w-full">
          Book your place
        </ButtonLink>
        <AddToCart slug={productSlug} block className="mt-3" />
      </>
    );
  }

  // By interview, with a batch taking applications: the application, or where
  // it stands. Once approved the sale status is "ok" and the Book button above
  // shows instead (owner, 2026-10-14).
  if (sale === "application" && viewer?.application) {
    return (
      <RetreatApplication
        name={name}
        batchId={viewer.application.batchId}
        batchLabel={viewer.application.batchLabel}
        status={viewer.application.status}
        signedIn={viewer.signedIn}
        signInHref={`/auth/sign-in?next=${encodeURIComponent(`/coaching/retreats/${slug}`)}`}
      />
    );
  }

  // `letters`: the next step is hearing about it, and sign-up lives in the
  // newsletter popup (there is no /newsletter page).
  const messages: Record<
    Exclude<SaleState, "ok">,
    { title: string; body: string; cta?: { href: string; label: string }; letters?: boolean }
  > = {
    closed: {
      title: "Booking opens soon",
      body: "The next batch has its dates, and booking opens shortly. Tony's letters carry the news first.",
      letters: true,
    },
    unscheduled: {
      title: "Date to be announced",
      body: "Booking opens as soon as the date is set. Tony's letters carry the news first.",
      letters: true,
    },
    ended: {
      title: "This retreat has finished",
      body: "The next dates will be announced here. Tony's letters carry the news first.",
      letters: true,
    },
    application: {
      title: "By interview",
      body: `Places on ${name} are offered after a short interview. Applications open with the next batch.`,
      letters: true,
    },
    full: {
      title: "Fully booked",
      body: "Every place has been taken. Get in touch and we will let you know if one comes free.",
      cta: { href: "/contact", label: "Get in touch" },
    },
    past: {
      title: "Booking has closed",
      body: "This retreat has begun. Tony's letters carry the news of the next one first.",
      letters: true,
    },
    unavailable: {
      title: "Not open for booking",
      body: "This level is not available to book just now.",
    },
  };
  const m = messages[sale === "ok" ? "unavailable" : sale];

  return (
    <div>
      <p className="font-display text-2xl font-semibold">{m.title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
      {m.cta ? (
        <ButtonLink href={m.cta.href} size="lg" className="mt-5 w-full">
          {m.cta.label}
        </ButtonLink>
      ) : null}
      {m.letters ? (
        <div className="mt-5">
          <NewsletterCta variant="primary" />
        </div>
      ) : null}
    </div>
  );
}
