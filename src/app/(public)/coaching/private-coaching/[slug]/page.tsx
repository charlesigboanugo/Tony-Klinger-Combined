import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GiftLink } from "@/components/coaching/GiftLink";
import { PackPurchase, type PackOption } from "@/components/coaching/PackPurchase";
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
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { optionsForProducts, validityNote } from "@/lib/commerce/options";
import { formatPrice } from "@/lib/commerce/pricing";
import { getCoachingService } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/private-coaching/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getCoachingService(slug);
  return service
    ? pageMetadata({
        title: service.name,
        description: service.description,
        path: `/coaching/private-coaching/${service.slug}`,
        image: { storagePath: service.storagePath, alt: service.name },
      })
    : { title: "Not found" };
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
  // Where times are chosen, once a session has been paid for.
  const bookHref = `/book/private/${service.slug}`;

  /*
    One session, or a pack (migration 0012), bought THE SAME WAY (owner,
    2026-10-08): pay first, then choose a time for each session. Until then one
    session was booked first and paid for while the time was held, the opposite
    order to the pack beside it.

    The pack is whichever products share the single session's option group, so
    it appears here the moment one is made active in admin and not before.
  */
  const options = service.productSlug
    ? ((await optionsForProducts([service.productSlug])).get(service.productSlug) ?? [])
    : [];

  const choices: PackOption[] = options.map((o) => {
    const count = o.credits ?? 1;
    const each = count > 1 ? `${formatPrice(Math.round(o.amount / count), o.currency)} a session` : null;
    return {
      slug: o.slug,
      label: o.label,
      price: formatPrice(o.amount, o.currency),
      priceNote: count > 1 ? `for ${count} sessions` : "a session",
      detail: [each ?? "Pay, then choose your time", validityNote(o.validMonths)].filter(Boolean).join(" · "),
      cta: { href: `/checkout?product=${o.slug}`, label: count > 1 ? `Buy ${count} sessions` : "Buy a session" },
      cart: true,
    };
  });
  // A service whose product has no option group still sells its one session.
  const buyHref = service.productSlug ? `/checkout?product=${service.productSlug}` : null;

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: "Coaching", path: "/coaching" },
          { name: "Private Coaching", path: "/coaching/private-coaching" },
          {
            name: service.name,
            path: `/coaching/private-coaching/${service.slug}`,
          },
        ]}
      />
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
            price={choices.length > 1 ? null : shown}
            priceNote={shown ? "a session" : null}
            // Cancellation policy, recovered from the coaching site's own
            // service page and enforced by `cancel_booking` (migration 0020).
            footnote="Cancel at least 48 hours ahead and the session is returned to your account to rebook."
          >
            {choices.length > 1 ? (
              <PackPurchase label="Number of sessions" options={choices} initial={service.productSlug ?? undefined} />
            ) : buyHref ? (
              <ButtonLink href={buyHref} size="lg" className="w-full">
                Buy a session
              </ButtonLink>
            ) : (
              <p className="text-sm text-muted-foreground">Not available to buy at the moment.</p>
            )}
            {buyHref ? <GiftLink href={`${buyHref}&gift=1`} /> : null}
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {service.duration_minutes} minutes with Tony, at a time that suits you.{" "}
              <Link href={bookHref} className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                See the times open now
              </Link>
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

        <ProductSection title="How booking works">
          <div className="max-w-2xl space-y-4 leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Pay first.</span> Buy one session, or a pack to use when
              you need them. Your sessions wait in your Academy.
            </p>
            <p>
              <span className="font-medium text-foreground">Then choose your time.</span> Pick a time from Tony&apos;s
              diary for each session, whenever you are ready, with nothing more to pay. You can see the times open now
              before you buy.
            </p>
            <p>The joining link appears in your Academy fifteen minutes before each session starts.</p>
          </div>
        </ProductSection>
      </ProductLayout>

      <MobileBuyBar
        price={shown}
        priceNote={shown ? "a session" : null}
        href={choices.length > 1 ? "#buy" : (buyHref ?? bookHref)}
        label={choices.length > 1 ? "Choose sessions" : "Buy a session"}
      />
    </>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
