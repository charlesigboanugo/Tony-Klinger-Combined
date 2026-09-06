import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/coaching/AddToCart";
import { OwnedState } from "@/components/coaching/OwnedState";
import { Container, Section } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
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

  return (
    <Section>
      <Container>
        <BackLink href="/coaching/group-coaching">All series</BackLink>

        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {series.name}
            </h1>
            {series.description ? (
              <p className="text-lg text-muted-foreground text-pretty">
                {series.description}
              </p>
            ) : null}

            {/* Note 07 §37.1 — a detail page must answer what it is, what is
                included, what it costs, how long, who for, and what happens
                next. Sessions/size/length are the shape of it; the syllabus
                below is what is actually covered; price comes from `prices`
                rather than being written into the markup. */}
            <dl className="grid gap-4 rounded-(--radius) border border-border bg-surface p-6 sm:grid-cols-4">
              <div>
                <dt className="text-sm text-muted-foreground">Sessions</dt>
                <dd className="mt-1 font-medium">
                  {series.syllabus.length > 0 ? series.syllabus.length : 8}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Group size</dt>
                <dd className="mt-1 font-medium">Up to 8</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Length</dt>
                <dd className="mt-1 font-medium">1 hour</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">From</dt>
                <dd className="mt-1 font-medium">
                  {formatPrice(single?.amount, single?.currency)}
                  <span className="font-normal text-muted-foreground"> a session</span>
                </dd>
              </div>
            </dl>

            {series.syllabus.length > 0 ? (
              <section aria-labelledby="covers">
                <h2 id="covers" className="text-xl font-semibold tracking-tight">
                  What the {series.syllabus.length} sessions cover
                </h2>
                <ol className="mt-4 space-y-2.5">
                  {series.syllabus.map((topic, i) => (
                    <li
                      key={topic}
                      className="flex gap-3 rounded-(--radius) border border-border bg-surface px-4 py-3"
                    >
                      <span className="shrink-0 tabular-nums font-medium text-accent">
                        {i + 1}
                      </span>
                      <span>{topic}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
          </div>

          <aside className="lg:pt-2">
            {/* Booking a specific session is separate from holding the
                entitlement — payment ≠ entitlement ≠ booking (note 01 §11). */}
            <OwnedState
              entitlement={entitlement}
              /* A series is not itself a product — Group Coaching is priced per
                 product (a single session, or the eight-session bundle), so the
                 purchase link names the BUNDLE product rather than the series. */
              buyHref={bundleSlug ? `/checkout?series=${bundleSlug}` : undefined}
              buyLabel="Buy this series"
              deliveryHref="/academy/coaching"
            />

            {entitlement.state !== "active" && (bundleSlug || singleSlug) ? (
              <AddToCart
                slug={(bundleSlug ?? singleSlug)!}
                label="Add the eight-session bundle"
                className="mt-4"
              />
            ) : null}
            <dl className="mt-5 space-y-3 rounded-(--radius) border border-border bg-surface p-5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">One session</dt>
                <dd className="font-medium">{formatPrice(single?.amount, single?.currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">All eight</dt>
                <dd className="font-medium">{formatPrice(bundle?.amount, bundle?.currency)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 border-t border-border pt-3">
                <dt className="text-muted-foreground">Or</dt>
                <dd className="text-right">
                  <Link href="/coaching/memberships" className="text-accent hover:underline">
                    included with membership
                  </Link>
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-sm text-muted-foreground">
              Buying access does not book a place: you choose a scheduled
              session afterwards, subject to availability. Sessions run online
              in groups of up to eight.
            </p>
          </aside>
        </div>
      </Container>
    </Section>
  );
}
