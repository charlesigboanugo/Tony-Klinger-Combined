import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "next/link";

import { TierPurchase } from "@/app/(public)/coaching/memberships/[slug]/TierPurchase";
import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
} from "@/components/coaching/ProductPage";
import { formatPrice } from "@/lib/commerce/pricing";
import { listMembershipTiers } from "@/lib/content/coaching";
import { designPhotos } from "@/lib/site/design-photos";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/memberships/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tiers = await listMembershipTiers();
  const tier = tiers.find((t) => t.slug === slug);
  return tier ? { title: tier.name } : { title: "Not found" };
}

export default async function MembershipTierPage({
  params,
}: PageProps<"/coaching/memberships/[slug]">) {
  const { slug } = await params;
  const tiers = await listMembershipTiers();
  const tier = tiers.find((t) => t.slug === slug);
  if (!tier) notFound();

  // Everything at or below this rank, because tiers are cumulative (note 07 §10).
  const below = tiers.filter((t) => t.rank < tier.rank).reverse();
  const previous = below[0];
  const monthly = tier.prices.find((p) => p.billing_type === "recurring") ?? null;
  const shown = monthly ? formatPrice(monthly.amount, monthly.currency) : null;
  const short = (name: string) => name.replace(/\s+Membership$/i, "");

  return (
    <>
      {/* No tier has artwork of its own; the membership portrait of Tony,
          freed when the Memberships banner went (2026-09-26), stands for all. */}
      <ProductHero
        backHref="/coaching/memberships"
        backLabel="All tiers"
        eyebrow="Membership"
        title={tier.name}
        description={tier.description}
        cover={{ src: designPhotos.memberships.src, focus: "object-[50%_20%]" }}
        price={shown ?? "Price on application"}
        priceNote={shown ? "a month" : null}
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
            <TierPurchase tierName={tier.name} productSlug={tier.productSlug} prices={tier.prices} />
            <p className="text-center text-sm">
              <Link href="/coaching/memberships" className="font-medium underline underline-offset-4 hover:text-accent">
                Compare all tiers
              </Link>
            </p>
          </div>
        }
      >
        <ProductFacts
          facts={[
            { label: "Pay", value: tier.prices.length > 1 ? "Monthly or yearly" : shown ? "Monthly" : "On application" },
            { label: "Includes", value: previous ? `All of ${short(previous.name)}` : "The first tier" },
            ...(monthly ? [{ label: "Monthly plan", value: "Cancel any time" }] : []),
          ]}
        />

        <ProductSection title={previous ? `Added at ${short(tier.name)}` : "What's included"}>
          <CheckList items={tier.benefits} />
        </ProductSection>

        {below.map((step) => (
          <ProductSection key={step.id} title={`Everything in ${short(step.name)}`}>
            <CheckList items={step.benefits} />
          </ProductSection>
        ))}
      </ProductLayout>

      <MobileBuyBar price={shown} priceNote={shown ? "a month" : null} href="#buy" label={`Join ${short(tier.name)}`} />
    </>
  );
}
