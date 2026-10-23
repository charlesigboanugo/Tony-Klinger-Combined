import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "next/link";

import { Suspense } from "react";

import { TierPurchase, TierPurchaseFromUrl } from "@/app/(public)/coaching/passes/[slug]/TierPurchase";
import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
} from "@/components/coaching/ProductPage";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { leadPrice } from "@/lib/commerce/billing";
import { formatPrice } from "@/lib/commerce/pricing";
import { listMembershipTiers, listPlaylists, listSeries } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";
import { designPhotos } from "@/lib/site/design-photos";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/passes/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tiers = await listMembershipTiers();
  const tier = tiers.find((t) => t.slug === slug);
  return tier
    ? pageMetadata({ title: tier.name, description: tier.description, path: `/coaching/passes/${tier.slug}` })
    : { title: "Not found" };
}

export default async function MembershipTierPage({
  params,
}: PageProps<"/coaching/passes/[slug]">) {
  const { slug } = await params;
  const [tiers, series, playlists] = await Promise.all([listMembershipTiers(), listSeries(), listPlaylists()]);
  const tier = tiers.find((t) => t.slug === slug);
  if (!tier) notFound();
  const rankOf = new Map(tiers.map((t) => [t.tier, t.rank]));

  // Membership is one payment for twelve months (owner, 2026-10-09). Everything
  // below is still worded from the prices on sale, so a subscription price
  // switched back on in admin is described as one.
  const monthly = tier.prices.find((p) => p.billing_type === "recurring" && p.interval === "month") ?? null;
  const yearlyRenews = tier.prices.some((p) => p.billing_type === "recurring" && p.interval === "year");
  const renews = tier.prices.some((p) => p.billing_type === "recurring");
  const lead = leadPrice(tier.prices);
  const shown = lead ? formatPrice(lead.price.amount, lead.price.currency) : null;
  const count = (n: number) => ["no", "one", "two", "three", "four"][n] ?? String(n);

  // Only the playlists a member of this tier may hold (the Miscellaneous
  // playlist is Gold and above).
  const visible = playlists.filter((p) => (rankOf.get(p.min_tier) ?? 0) <= tier.rank);
  const choosable = visible.map((p) => p.name);

  /*
    How it works, built from the tier's own settings (migration 0012) rather
    than written per tier: change an allowance in admin and this page follows.
    A member has to know what they will be asked to choose and when — that a
    Silver member picks one series is the single most important thing about
    Silver, and a benefits list alone does not say how.
  */
  const steps: string[] = [
    renews
      ? "Buy it, and your pass starts straight away. Everything it includes is in your Academy."
      : "Buy it, and your pass starts straight away and runs for twelve months. Everything it includes is in your Academy.",
    tier.seriesAllowance == null
      ? `Every Group Coaching series is open to you: ${listOf(series.map((s) => s.name))}.`
      : `Your pass includes ${count(tier.seriesAllowance)} Group Coaching series in the year, from ${listOf(series.map((s) => s.name))}.`,
    "Each series runs for eight weeks and opens for registration before it starts. As a pass holder you can register ahead of everyone else. Register for the one you want, in your Academy, and your seat is kept in all eight sessions, with no booking. A series you register for during your year is yours to finish, even if the year ends first.",
    tier.playlistAllowance == null
      ? `Watch every video playlist: ${listOf(choosable)}. New videos appear as they are added.`
      : `Choose your video playlist from ${listOf(choosable, "or")}. New videos appear in it as they are added.`,
    ...(tier.includesQa
      ? ["Join Tony's live Q&A each month. Send your questions in beforehand; the recording is there afterwards."]
      : []),
    ...(tier.includesRetreats
      ? [
          tier.retreatsRequireYearly && monthly
            ? "On the yearly plan, entry to every Level One Virtual Retreat held during your year is included, at no extra cost. You will be told each date as soon as it is set."
            : "Entry to every Level One Virtual Retreat held during your year is included, at no extra cost. You will be told each date as soon as it is set.",
        ]
      : []),
  ];

  return (
    <>
      {/* No tier has artwork of its own; one photo of Tony stands for all. */}
      <BreadcrumbJsonLd
        trail={[
          { name: "Coaching", path: "/coaching" },
          { name: "Coaching Passes", path: "/coaching/passes" },
          { name: tier.name, path: `/coaching/passes/${tier.slug}` },
        ]}
      />
      <ProductHero
        backHref="/coaching/passes"
        backLabel="All tiers"
        eyebrow="Coaching Pass"
        title={tier.name}
        description={tier.description}
        cover={{ src: designPhotos.memberships.src, alt: designPhotos.memberships.alt, focus: designPhotos.memberships.focus }}
        price={shown ?? "Price on application"}
        priceNote={lead?.note ?? null}
      />

      <ProductLayout
        aside={
          /*
            Price and purchase, as one interactive block. It honours the period
            chosen on the listing grid (arriving as ?billing=), lets it be
            changed here, and carries the final choice into checkout — so the
            figure shown is the figure charged (note 09 §16.1).
          */
          <div className="space-y-4">
            <Suspense fallback={<TierPurchase tierName={tier.name} rank={tier.rank} productSlug={tier.productSlug} prices={tier.prices} />}>
              <TierPurchaseFromUrl tierName={tier.name} rank={tier.rank} productSlug={tier.productSlug} prices={tier.prices} />
            </Suspense>
            <p className="text-center text-sm">
              <Link href="/coaching/passes" className="font-medium underline underline-offset-4 hover:text-accent">
                Compare all tiers
              </Link>
            </p>
          </div>
        }
      >
        <ProductFacts
          facts={[
            {
              label: "Pay",
              value:
                !shown
                  ? "On application"
                  : !renews
                    ? "Once, for twelve months"
                    : tier.prices.length > 1
                      ? yearlyRenews
                        ? "Monthly or yearly"
                        : "Monthly, or once for a year"
                      : "Monthly",
            },
            {
              label: "Group Coaching",
              value:
                tier.seriesAllowance == null
                  ? "Every series"
                  : `${count(tier.seriesAllowance)} series a year`.replace(/^./, (c) => c.toUpperCase()),
            },
            ...(monthly
              ? [{ label: yearlyRenews ? "Renews" : "Monthly plan", value: yearlyRenews ? "Until you cancel" : "Cancel any time" }]
              : shown
                ? [{ label: "Renews", value: "No, it ends after the year" }]
                : []),
          ]}
        />

        <ProductSection title="What's included">
          <CheckList items={tier.benefits} />
        </ProductSection>

        <ProductSection title="How it works">
          {/* In order, but not numbered (owner: no "No. 1" numbering) — a
              rule marks each step instead. */}
          <ol className="max-w-2xl space-y-5">
            {steps.map((step) => (
              <li key={step} className="flex gap-4 leading-relaxed">
                <span aria-hidden="true" className="mt-[0.8em] h-px w-6 shrink-0 bg-primary" />
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </ProductSection>

        <ProductSection title={renews ? "Paying and cancelling" : "Paying, and when the year ends"}>
          <div className="max-w-2xl space-y-4 leading-relaxed text-muted-foreground">
            {monthly ? (
              <p>
                <span className="font-medium text-foreground">Monthly.</span> Your pass renews each month until
                you cancel. Cancel whenever you like, from your account: nothing more is taken, and you keep everything
                until the end of the month you have paid for.
              </p>
            ) : null}
            {yearlyRenews ? (
              <p>
                <span className="font-medium text-foreground">Yearly.</span> One payment a year. It renews each year
                until you cancel: cancel at any time and you keep everything until the end of the year you have paid
                for.
              </p>
            ) : (
              <p>
                <span className="font-medium text-foreground">One payment.</span> You pay once, for twelve months. It does not renew by itself and nothing more is taken, so there is nothing to cancel.
              </p>
            )}
            {renews ? null : (
              <p>
                <span className="font-medium text-foreground">After the year.</span> Your pass ends on the date
                shown in your account. You can buy another twelve months, on the same tier or a different
                one, from thirty days before that date.
              </p>
            )}
            <p>
              When a pass ends, so does access to what it included. Anything you bought separately stays yours.
            </p>
          </div>
        </ProductSection>
      </ProductLayout>

      <MobileBuyBar price={shown} priceNote={lead?.note ?? null} href="#buy" label={`Get ${tier.name}`} />
    </>
  );
}

/** "A, B and C" — a list as a sentence reads it. */
function listOf(names: string[], joiner: "and" | "or" = "and"): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} ${joiner} ${names.at(-1)}`;
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
