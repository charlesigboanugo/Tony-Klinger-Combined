import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/coaching/AddToCart";
import { OwnedState } from "@/components/coaching/OwnedState";
import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
import { entitlementFor } from "@/lib/commerce/entitlements";
import { formatPrice } from "@/lib/commerce/pricing";
import { getSeries, priceForProductSlug } from "@/lib/content/coaching";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/group-coaching/[seriesSlug]">): Promise<Metadata> {
  const { seriesSlug } = await params;
  const series = await getSeries(seriesSlug);
  return series ? { title: series.name } : { title: "Not found" };
}

/**
 * Group Coaching series detail — note 07 §37.1, the shared product page.
 *
 * A detail page must answer what it is, what is included, what it costs, how
 * long, who for, and what happens next. The syllabus is read from `syllabus`,
 * never parsed out of prose.
 */
export default async function SeriesPage({
  params,
}: PageProps<"/coaching/group-coaching/[seriesSlug]">) {
  const { seriesSlug } = await params;
  const series = await getSeries(seriesSlug);
  if (!series) notFound();

  const [entitlement, single, bundle] = await Promise.all([
    entitlementFor("group_coaching_series", series.id),
    priceForProductSlug("group-coaching-single"),
    priceForProductSlug("group-coaching-x8"),
  ]);

  /*
    Group Coaching is priced PER PRODUCT, not per series — one session, or the
    eight-session bundle, both of which apply to every series (note 07 §14). So
    the purchase links name those products rather than the series, which has no
    product of its own. Null when the price is missing, so no button is shown
    that would lead to an empty checkout.
  */
  const singleSlug = single ? "group-coaching-single" : null;
  const bundleSlug = bundle ? "group-coaching-x8" : null;
  const owned = entitlement.state === "active";
  const sessions = series.syllabus.length > 0 ? series.syllabus.length : 8;

  const singleShown = single ? formatPrice(single.amount, single.currency) : null;
  const bundleShown = bundle ? formatPrice(bundle.amount, bundle.currency) : null;
  const buyHref = bundleSlug ? `/checkout?series=${bundleSlug}` : undefined;

  return (
    <>
      <ProductHero
        backHref="/coaching/group-coaching"
        backLabel="All series"
        eyebrow="Group series"
        title={series.name}
        description={series.description}
        cover={{ path: series.storagePath }}
        price={bundleShown}
        priceNote={bundleShown ? `for all ${sessions} sessions` : null}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            price={owned ? null : bundleShown}
            priceNote={owned ? null : `all ${sessions} sessions`}
            footnote={
              <>
                Buying access does not book a place: you choose a scheduled
                session afterwards, subject to availability. Also{" "}
                <Link href="/coaching/memberships" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  included with membership
                </Link>
                .
              </>
            }
          >
            {/* Booking a specific session is separate from holding the
                entitlement — payment ≠ entitlement ≠ booking (note 01 §11). */}
            <OwnedState
              plain
              entitlement={entitlement}
              buyHref={buyHref}
              buyLabel="Buy the series"
              deliveryHref="/academy/coaching"
            />
            {!owned && bundleSlug ? (
              <AddToCart
                slug={bundleSlug}
                label="Add the series to cart"
                className="mt-3 [&_button]:w-full [&_form]:w-full"
              />
            ) : null}

            {!owned && singleSlug && singleShown ? (
              <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
                <p>
                  <span className="block text-sm text-muted-foreground">Or one session</span>
                  <span className="font-display text-2xl font-semibold tabular-nums">{singleShown}</span>
                </p>
                <AddToCart slug={singleSlug} label="Add one" />
              </div>
            ) : null}
          </PurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Sessions", value: `${sessions}, one hour each` },
            { label: "Group", value: "Up to eight people" },
            { label: "Where", value: "Online, live" },
            ...(singleShown ? [{ label: "Or", value: `${singleShown} a session` }] : []),
          ]}
        />

        {series.syllabus.length > 0 ? (
          <ProductSection title={`What the ${sessions} sessions cover`}>
            <CheckList items={series.syllabus} columns={2} />
          </ProductSection>
        ) : null}
      </ProductLayout>

      {!owned && buyHref ? (
        <MobileBuyBar price={bundleShown} priceNote={`all ${sessions}`} href={buyHref} label="Buy series" />
      ) : null}
    </>
  );
}
