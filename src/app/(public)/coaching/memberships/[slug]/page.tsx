import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import { TierPurchase } from "@/app/(public)/coaching/memberships/[slug]/TierPurchase";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { listMembershipTiers } from "@/lib/content/coaching";

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
  const included = tiers.filter((t) => t.rank <= tier.rank);

  return (
    <Section>
      <Container width="narrow">
        <BackLink href="/coaching/memberships">All tiers</BackLink>

        <div className="mt-6 space-y-6">
          <div className="space-y-3">
            <p className="text-sm tracking-wide text-accent uppercase">
              Membership · tier {tier.rank} of {tiers.length}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {tier.name}
            </h1>
            {tier.description ? (
              <p className="text-lg text-muted-foreground text-pretty">
                {tier.description}
              </p>
            ) : null}
          </div>

          <div className="rounded-(--radius) border border-border bg-surface p-6">
            <h2 className="font-medium">What&apos;s included</h2>
            <div className="mt-4 space-y-5">
              {included
                .slice()
                .reverse()
                .map((step) => (
                  <div key={step.id}>
                    <p className="text-sm font-medium">
                      {step.id === tier.id ? "Added at this tier" : `From ${step.name}`}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      {step.benefits.map((benefit) => (
                        <li key={benefit} className="flex gap-2">
                          <span aria-hidden="true" className="text-accent">+</span>
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>

          {/*
            Price and purchase, as one interactive block. It honours the period
            chosen on the listing grid (arriving as ?billing=), lets it be
            changed here, and carries the final choice into checkout — so the
            figure shown is the figure charged (note 09 §16.1).
          */}
          <TierPurchase
            tierName={tier.name}
            productSlug={tier.productSlug}
            prices={tier.prices}
          />

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/coaching/memberships" variant="outline">
              Compare tiers
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
