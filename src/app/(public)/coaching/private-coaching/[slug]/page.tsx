import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
import { ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCoachingService } from "@/lib/content/coaching";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/private-coaching/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getCoachingService(slug);
  return service ? { title: service.name, description: service.description ?? undefined } : { title: "Not found" };
}

/** Private coaching service detail — note 07 §37.1: what it is, what it costs,
 * how long, what happens next, all on this page rather than the card alone.
 * The shared product page (ProductPage.tsx). */
export default async function PrivateCoachingServicePage({
  params,
}: PageProps<"/coaching/private-coaching/[slug]">) {
  const { slug } = await params;
  const service = await getCoachingService(slug);
  if (!service) notFound();

  const price = service.prices[0] ?? null;
  const shown = price ? formatPrice(price.amount, price.currency) : null;
  // Choose a time, then pay (note 09 §35, migration 0020).
  const bookHref = `/bookings/private/${service.slug}`;

  return (
    <>
      <ProductHero
        backHref="/coaching/private-coaching"
        backLabel="Private coaching"
        eyebrow="One to one"
        title={service.name}
        description={service.description}
        cover={{ path: service.storagePath }}
        price={shown ?? "Price on application"}
        priceNote={shown ? "a session" : null}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            price={shown}
            priceNote={shown ? "a session" : null}
            // Cancellation policy, recovered from the coaching site's own
            // service page and enforced by `cancel_booking` (migration 0020).
            footnote="Cancel at least 48 hours ahead and the session is returned to your account to rebook."
          >
            <ButtonLink href={bookHref} size="lg" className="w-full">
              Check availability
            </ButtonLink>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {service.duration_minutes} minutes with Tony, at a time that suits you.
            </p>
          </PurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Length", value: `${service.duration_minutes} minutes` },
            { label: "With", value: "Tony, one to one" },
            { label: "When", value: "Around your diary" },
          ]}
        />

        {service.benefits.length > 0 ? (
          <ProductSection title="What's included">
            <CheckList items={service.benefits} />
          </ProductSection>
        ) : null}
      </ProductLayout>

      <MobileBuyBar price={shown} priceNote={shown ? "a session" : null} href={bookHref} label="Check availability" />
    </>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
