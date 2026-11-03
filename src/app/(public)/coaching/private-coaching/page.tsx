import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { FaqBlock } from "@/components/content/FaqList";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { optionsForProducts, packSaving, packSavingOffer } from "@/lib/commerce/options";
import { formatPrice, passPerkLabel } from "@/lib/commerce/pricing";
import { listCoachingServices, listMembershipTiers } from "@/lib/content/coaching";
import { privateCoachingFaqs } from "@/lib/content/product-faqs";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Private Coaching",
  description:
    "One-to-one coaching with Tony Klinger.",
  path: "/coaching/private-coaching",
});

export default async function PrivateCoachingPage() {
  const [services, tiers] = await Promise.all([listCoachingServices(), listMembershipTiers()]);
  // The pass holders' discount on a single session (migration 0026), from the
  // passes on sale, so it sells the pass from here too.
  const perk = passPerkLabel(tiers.filter((t) => t.prices.length > 0).map((t) => t.oneToOneDiscount));
  // Each service's single and its pack, for the saving on its card.
  const options = await optionsForProducts(services.flatMap((s) => (s.productSlug ? [s.productSlug] : [])));
  // For the questions: the first service's own single and pack, and each pass's discount.
  const faqOptions = (services[0]?.productSlug ? options.get(services[0].productSlug) : undefined) ?? [];
  const faqSingle = faqOptions.find((o) => (o.credits ?? 1) === 1) ?? null;
  const faqPack = faqOptions.find((o) => (o.credits ?? 1) > 1) ?? null;
  const discountList = tiers
    .filter((t) => t.prices.length > 0 && t.oneToOneDiscount > 0)
    .map((t) => `${t.oneToOneDiscount}% off with a ${t.name}`);
  const discountWords =
    discountList.length === 0
      ? null
      : discountList.length === 1
        ? discountList[0]
        : `${discountList.slice(0, -1).join(", ")} and ${discountList.at(-1)}`;

  return (
    <Section>
      <Container>
        <PageHeader
          split
          eyebrow="Coaching"
          title="Private Coaching"
          description="An hour with Tony on your own project or career, at a time that suits you. Book a single session, or a pack of 8 sessions to use when you need them."
        />

        {services.length === 0 ? (
          <EmptyState
            title="No services published yet"
            description="Private coaching availability is announced here."
          />
        ) : (
          <OfferGrid count={services.length}>
            {services.map((service, i) => (
              <Reveal as="li" key={service.id} delay={(i % 3) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/private-coaching/${service.slug}`}
                  title={service.name}
                  description={service.description}
                  eyebrow="One to one"
                  cta="View and buy"
                  meta={`${service.duration_minutes} minutes`}
                  priceNote="a session"
                  saving={service.productSlug ? packSavingOffer(options.get(service.productSlug) ?? [])?.label : null}
                  perk={perk}
                  prices={service.prices}
                  storagePath={service.storagePath}
                  seed={service.slug}
                  priority={i < 3}
                  feature={services.length === 1}
                />
              </Reveal>
            ))}
          </OfferGrid>
        )}

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Private coaching is separate from the Coaching Pass: it is booked session
          by session, or bought as a pack of 8 sessions.
        </p>

        {/* The questions on the service's page, here too (owner, 2026-11-02),
            from the first service's own single, pack and pass discounts. */}
        {faqOptions.length > 0 ? (
          <FaqBlock
            items={privateCoachingFaqs({
              validMonths: faqSingle?.validMonths ?? null,
              pack: faqPack
                ? {
                    sessions: faqPack.credits ?? 8,
                    saving: packSaving(faqPack, faqOptions) > 0 ? formatPrice(packSaving(faqPack, faqOptions), faqPack.currency) : null,
                    validMonths: faqPack.validMonths,
                  }
                : null,
              passDiscounts: discountWords,
            })}
          />
        ) : null}
      </Container>
    </Section>
  );
}
