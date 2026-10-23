import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RetreatPurchase, type SaleState } from "@/app/(public)/coaching/retreats/[slug]/RetreatPurchase";
import { OptionSwitch } from "@/components/coaching/OptionSwitch";
import {
  CheckList,
  MobileBuyBar,
  ProductFacts,
  ProductHero,
  ProductLayout,
  ProductSection,
  PurchasePanel,
} from "@/components/coaching/ProductPage";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { datedStatus } from "@/lib/content/offer-status";
import { formatPrice } from "@/lib/commerce/pricing";
import { getRetreat, listRetreats } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";
import { createPublicClient } from "@/lib/supabase/public";

const UK = "Europe/London";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/retreats/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const retreat = await getRetreat(slug);
  return retreat
    ? pageMetadata({
        title: retreat.name,
        description: retreat.description,
        path: `/coaching/retreats/${retreat.slug}`,
        image: { storagePath: retreat.storagePath, alt: retreat.name },
      })
    : { title: "Not found" };
}

/**
 * Retreat detail — note 07 §26, §37.1; the shared product page.
 *
 * A retreat may run at several LEVELS (the Virtual Retreat has three). Each
 * level is its own retreat row and its own product, because each has its own
 * price, its own places and its own way in; this page is one level, with a
 * switch to the others across the top of the purchase panel so comparing them
 * never means going back to the list.
 *
 * NO DATE IS A REAL STATE, not a gap to hide (owner, 2026-10-08: the dates are
 * not yet available). The page says "to be announced", offers the newsletter,
 * and sells nothing until an administrator sets the date — the same rule
 * checkout enforces (`coaching_sale_status`, migration 0012).
 */
export default async function RetreatPage({ params }: PageProps<"/coaching/retreats/[slug]">) {
  const { slug } = await params;
  const [retreat, all] = await Promise.all([getRetreat(slug), listRetreats()]);
  if (!retreat) notFound();

  const price = retreat.prices.length ? retreat.prices.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
  const shown = price ? formatPrice(price.amount, price.currency) : null;

  // The other levels of the same retreat: every published retreat that has a
  // level, in order. A retreat with no level has no switch.
  const levels = retreat.level != null ? all.filter((r) => r.level != null) : [];

  const starts = retreat.starts_at ? new Date(retreat.starts_at) : null;
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: UK });
  // Run and over, with nothing new yet: say so, not "to be announced".
  const when = starts ? day(starts.toISOString()) : retreat.endedAt ? `Last ran ${day(retreat.endedAt)}` : "To be announced";
  // Later batches of the same retreat, so a visitor sees when it runs again.
  const later = retreat.batches.slice(1);

  // What the public facts alone say. The purchase component refines it for the
  // visitor (already holds a place, application approved, places gone).
  const initial: SaleState = !retreat.productSlug
    ? "unavailable"
    : !starts
      ? retreat.endedAt
        ? "ended"
        : "unscheduled"
      : retreat.begun
        ? "past"
        : retreat.requires_application
        ? "application"
        : "ok";

  // The product id, for the sale check. Public data, like the rest of the page.
  let productId: string | null = null;
  if (retreat.productSlug) {
    const { data } = await createPublicClient()
      .from("products")
      .select("id")
      .eq("slug", retreat.productSlug)
      .maybeSingle();
    productId = (data as { id: string } | null)?.id ?? null;
  }

  return (
    <>
      <BreadcrumbJsonLd
        trail={[
          { name: "Coaching", path: "/coaching" },
          { name: "Retreats", path: "/coaching/retreats" },
          { name: retreat.name, path: `/coaching/retreats/${retreat.slug}` },
        ]}
      />
      <ProductHero
        backHref="/coaching/retreats"
        backLabel="All retreats"
        eyebrow={retreat.inProgress ? "Retreat · in progress" : retreat.requires_application ? "Retreat · by interview" : "Retreat"}
        title={retreat.name}
        description={retreat.description}
        cover={{ path: retreat.storagePath }}
        price={shown}
        priceNote={shown ? "one payment" : null}
        status={datedStatus({ startsAt: retreat.starts_at, endsAt: retreat.ends_at, inProgress: retreat.inProgress, endedAt: retreat.endedAt })}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            price={shown}
            priceNote={shown ? "one payment" : null}
            footnote={
              <>
                The Platinum Pass includes free entry to every Level One Virtual Retreat.{" "}
                <Link href="/coaching/passes/platinum" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  See Platinum
                </Link>
              </>
            }
          >
            {levels.length > 1 ? (
              <OptionSwitch
                label="Retreat level"
                stretch
                className="mb-6"
                options={levels.map((r) => ({
                  value: r.slug,
                  label: levelName(r.level),
                  active: r.slug === retreat.slug,
                  href: `/coaching/retreats/${r.slug}`,
                }))}
              />
            ) : null}

            <RetreatPurchase
              retreatId={retreat.id}
              productId={productId}
              productSlug={retreat.productSlug}
              name={retreat.name}
              slug={retreat.slug}
              initial={initial}
            />
          </PurchasePanel>
        }
      >
        <ProductFacts
          facts={[
            { label: "Length", value: "One day" },
            { label: "Where", value: "Online, live" },
            { label: "When", value: retreat.batchLabel ? `${when} (${retreat.batchLabel})` : when },
            ...(later.length > 0
              ? [{ label: "Also running", value: later.map((b) => `${day(b.startsAt)} (${b.label})`).join("; ") }]
              : []),
            { label: "Entry", value: retreat.requires_application ? "By interview" : "Open to all" },
            ...(retreat.capacity ? [{ label: "Places", value: String(retreat.capacity) }] : []),
          ]}
        />

        {retreat.benefits.length > 0 ? (
          <ProductSection title="What's included">
            <CheckList items={retreat.benefits} />
          </ProductSection>
        ) : null}

        {levels.length > 1 ? (
          <ProductSection title="The levels">
            {/* Every level, with what sets it apart, so the choice can be made
                on this page. A ruled list, not cards: three short facts. */}
            <ul className="max-w-2xl divide-y divide-border border-y border-border">
              {levels.map((r) => {
                const p = r.prices.length ? r.prices.reduce((a, b) => (a.amount <= b.amount ? a : b)) : null;
                const current = r.slug === retreat.slug;
                return (
                  <li key={r.id} className="flex flex-col gap-1 py-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {current ? (
                          <span>{levelName(r.level)}</span>
                        ) : (
                          <Link href={`/coaching/retreats/${r.slug}`} className="underline underline-offset-4 hover:text-accent">
                            {levelName(r.level)}
                          </Link>
                        )}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          {r.requires_application ? "By interview" : "Open to all"}
                          {current ? " · this page" : ""}
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.description}</p>
                    </div>
                    {p ? (
                      <p className="shrink-0 font-display text-xl font-semibold tabular-nums">
                        {formatPrice(p.amount, p.currency)}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </ProductSection>
        ) : null}
      </ProductLayout>

      <MobileBuyBar price={shown} priceNote={shown ? "one payment" : null} href="#buy" label={starts ? "Book your place" : "See details"} />
    </>
  );
}

/** "Level One", in words, as the courses' levels are written (owner, 2026-10-08). */
function levelName(level: number | null): string {
  const words = ["", "One", "Two", "Three", "Four", "Five", "Six"];
  return level ? `Level ${words[level] ?? level}` : "Level";
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
