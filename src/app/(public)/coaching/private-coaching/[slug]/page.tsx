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
import { FaqList } from "@/components/content/FaqList";
import { ButtonLink } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { optionsForProducts, packSaving, packSavingOffer, validityNote } from "@/lib/commerce/options";
import { formatPrice, passPerkLabel } from "@/lib/commerce/pricing";
import { getCoachingService, listMembershipTiers } from "@/lib/content/coaching";
import { privateCoachingFaqs } from "@/lib/content/product-faqs";
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
    ONE SESSION: CHOOSE THE TIME, THEN PAY (owner, 2026-11-10; migration 0030).
    The time is held while they pay, so two buyers can never pay for the same
    one. A PACK (migration 0012) is still paid for first and each session booked
    afterwards, since nobody knows eight dates on the day they buy. From
    2026-10-08 until then, both were pay first.

    The pack is whichever products share the single session's option group, so
    it appears here the moment one is made active in admin and not before.
  */
  const options = service.productSlug
    ? ((await optionsForProducts([service.productSlug])).get(service.productSlug) ?? [])
    : [];

  const choices: PackOption[] = options.map((o) => {
    const count = o.credits ?? 1;
    const each = count > 1 ? `${formatPrice(Math.round(o.amount / count), o.currency)} a session` : null;
    const saved = packSaving(o, options);
    return {
      slug: o.slug,
      label: o.label,
      price: formatPrice(o.amount, o.currency),
      priceNote: count > 1 ? `for ${count} sessions` : "a session",
      detail: [count > 1 ? each : "Choose your time, then pay", count > 1 ? "book each session when you like" : null, validityNote(o.validMonths)].filter(Boolean).join(" · "),
      saving: saved > 0 ? `Save ${formatPrice(saved, o.currency)}` : null,
      // One session goes to the times first; a pack straight to checkout.
      cta: count > 1 ? { href: `/checkout?product=${o.slug}`, label: `Buy ${count} sessions` } : { href: bookHref, label: "Choose a time" },
      // A single session is bought for a time, so it cannot wait in the cart.
      cart: count > 1,
      // A single session takes a pass holder's discount; the pack does not.
      ...(count === 1 ? { amount: o.amount, currency: o.currency, passDiscountable: true } : {}),
    };
  });
  const offer = packSavingOffer(options);
  // The pass holders' discount on a single session (migration 0026), from the
  // passes on sale: beside the price, and in the buy panel.
  const tiersOnSale = (await listMembershipTiers()).filter((t) => t.prices.length > 0);
  const perk = passPerkLabel(tiersOnSale.map((t) => t.oneToOneDiscount));
  // For the questions: the single's lifetime, the pack and each pass's discount.
  const singleOption = options.find((o) => (o.credits ?? 1) === 1) ?? null;
  const packOption = options.find((o) => (o.credits ?? 1) > 1) ?? null;
  const packSaved = packOption ? packSaving(packOption, options) : 0;
  const discounts = tiersOnSale.filter((t) => t.oneToOneDiscount > 0).map((t) => `${t.oneToOneDiscount}% off with a ${t.name}`);
  // A service whose product has no option group still sells its one session.
  const buyHref = service.productSlug ? `/checkout?product=${service.productSlug}` : null;
  // No time open in Tony's diary: not on sale, so nobody pays with nothing to
  // book (migration 0029, owner 2026-11-10). Checkout refuses it too.
  const waiting = !service.timesOpen && (buyHref !== null || choices.length > 0);

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
        saving={offer?.label}
        perk={perk}
        perkHref="/coaching/passes"
        status={waiting ? { tone: "quiet", label: "Dates to be advised" } : null}
        // To the buy panel with the pack chosen (PackPurchase reads the hash).
        savingHref={offer && choices.length > 1 ? `#buy-${offer.slug}` : null}
      />

      {/* Questions people ask about one-to-one coaching (owner, 2026-11-02). */}
      <ProductLayout
        closing={
          <ProductSection title="FAQs" quiet>
            <FaqList items={privateCoachingFaqs({ validMonths: singleOption?.validMonths ?? null, pack: packOption ? { sessions: packOption.credits ?? 8, saving: packSaved > 0 ? formatPrice(packSaved, packOption.currency) : null, validMonths: packOption.validMonths } : null, passDiscounts: discounts.length > 0 ? discounts.length > 1 ? `${discounts.slice(0, -1).join(", ")} and ${discounts.at(-1)}` : discounts[0] : null })} className="max-w-2xl" />
          </ProductSection>
        }
        aside={
          <PurchasePanel
            price={choices.length > 1 ? null : shown}
            priceNote={shown ? "a session" : null}
            // Cancellation policy, recovered from the coaching site's own
            // service page and enforced by `cancel_booking` (migration 0020).
            footnote="Cancel at least 48 hours ahead and the session is returned to your account to rebook."
          >
            {waiting ? (
              <div>
                <p className="font-display text-2xl font-semibold">Dates to be advised</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Sessions go on sale as soon as Tony opens times in his diary, so you never pay with nothing to book.
                </p>
                <div className="mt-5">
                  <ButtonLink href="/contact" variant="outline" className="w-full">Get in touch</ButtonLink>
                </div>
              </div>
            ) : choices.length > 1 ? (
              <PackPurchase label="Number of sessions" options={choices} initial={service.productSlug ?? undefined} passPerk={perk} />
            ) : buyHref ? (
              <ButtonLink href={bookHref} size="lg" className="w-full">
                Choose a time
              </ButtonLink>
            ) : (
              <p className="text-sm text-muted-foreground">Not available to buy at the moment.</p>
            )}
            {buyHref && !waiting ? <GiftLink href={`${buyHref}&gift=1`} /> : null}
            {waiting ? null : <p className="mt-4 text-center text-sm text-muted-foreground">
              {service.duration_minutes} minutes with Tony, at a time that suits you.{" "}
              <Link href={bookHref} className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                See the times open now
              </Link>
            </p>}
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
              <span className="font-medium text-foreground">One session.</span> Pick a time from Tony&apos;s diary,
              then pay. The time is held for you while you pay, and booked as soon as payment goes through.
            </p>
            <p>
              <span className="font-medium text-foreground">A pack of 8.</span> Pay once, and your sessions wait in your
              Academy. Pick a time for each one whenever you are ready, with nothing more to pay.
            </p>
            <p>The joining link appears in your Academy fifteen minutes before each session starts.</p>
          </div>
        </ProductSection>
      </ProductLayout>

      <MobileBuyBar
        price={shown}
        priceNote={shown ? "a session" : null}
        href={waiting || choices.length > 1 ? "#buy" : bookHref}
        label={waiting ? "Dates to be advised" : choices.length > 1 ? "Choose sessions" : "Choose a time"}
      />
    </>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
