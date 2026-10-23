import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PackPurchase, type PackOption } from "@/components/coaching/PackPurchase";
import { CheckList, MobileBuyBar, ProductFacts, ProductHero, ProductLayout, ProductSection, PurchasePanel } from "@/components/coaching/ProductPage";
import { OwnershipProvider, UnlessOwned, ViewerOwnedNotice } from "@/components/coaching/ViewerOwnership";
import { NewsletterCta } from "@/components/content/NewsletterPopup";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { phaseStatus } from "@/lib/content/offer-status";
import { optionGroup } from "@/lib/commerce/options";
import { formatPrice } from "@/lib/commerce/pricing";
import { getSeries, listComingSessions, listRuns } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/coaching/group-coaching/[seriesSlug]">): Promise<Metadata> {
  const { seriesSlug } = await params;
  const series = await getSeries(seriesSlug);
  return series
    ? pageMetadata({
        title: series.name,
        description: series.description,
        path: `/coaching/group-coaching/${series.slug}`,
        image: { storagePath: series.storagePath, alt: series.name },
      })
    : { title: "Not found" };
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

  /*
    A SERIES RUNS BETWEEN TWO DATES (owner, 2026-10-09; migrations 0016, 0021,
    0022, 0024). Nothing here is booked afterwards: paying puts the buyer where
    they paid to be.

      FIRST, THE SERIES (£130): a seat in all eight sessions of its run. Sold
      from the day registration opens until the series starts, while it has a
      place. One run takes registrations at a time; a second opens only when
      the first is full.

      THEN, SINGLE SESSIONS (£25): once registration for the series has
      closed — at its start, or on an earlier date set for the run (migration
      0025) — each session still to come is sold on its own, for the date the
      buyer picks here, while it has a seat.

    The two are never on sale together, so a single sale cannot take a place
    off the series. Each series has its own two products, sharing an option
    group named after it; buying here is what ties them to this series.
  */
  const [options, runs, coming] = await Promise.all([
    optionGroup(`group-coaching-${series.slug}`),
    listRuns([series.id]),
    listComingSessions(series.id),
  ]);
  const sessions = series.syllabus.length > 0 ? series.syllabus.length : 8;

  // What the public facts say about buying now. The purchase panel refines it
  // for the visitor (already registered, paid and not yet used) after load,
  // and checkout asks the database before taking anything.
  const open = runs.filter((r) => r.state === "open");
  const next = runs.find((r) => r.state === "upcoming") ?? null;
  const seriesOnSale = open.length > 0;
  // When the series stops selling and its single sessions start (migration
  // 0025): a date set for the run, or its start.
  const closing = open[0] ?? null;
  // A session is on sale only while it has a seat.
  const sessionsOnSale = coming.some((c) => c.placesLeft > 0);
  const onSale = seriesOnSale || sessionsOnSale;


  /*
    THE HEADLINE PRICE IS FOR WHAT IS ON SALE (owner, 2026-10-09): the series
    price while the series is what is sold or next to be, the session price
    once its sessions are. "£25 a session" over a series that could only be
    bought whole was misleading.
  */
  const wholeOption = options.find((o) => (o.credits ?? 1) > 1) ?? null;
  const singleOption = options.find((o) => (o.credits ?? 1) <= 1) ?? null;
  const singlesPhase = !seriesOnSale && sessionsOnSale;
  // When it is on, for the hero's chip; a CLOSED series shows no price at all
  // (owner, 2026-10-09): there is nothing to buy.
  const status = phaseStatus(runs, { singleSessionsLeft: coming.filter((c) => c.placesLeft > 0).length });
  const headline =
    status.tone === "closed" ? null : singlesPhase ? (singleOption ?? wholeOption) : (wholeOption ?? singleOption);
  const fromPrice = headline ? formatPrice(headline.amount, headline.currency) : null;
  const fromNote = headline ? (headline === wholeOption ? `for all ${sessions} sessions` : "a session") : null;
  // Said to somebody who wants one session while only the series is on sale.
  // The DATE single sessions open, and nothing about the series beginning
  // (owner, 2026-10-09): that date is set for the run and may fall before the
  // series starts, so "when the series starts" was not accurate.
  const singlesLater =
    seriesOnSale && singleOption && closing
      ? `Only want one session? Single sessions, ${formatPrice(singleOption.amount, singleOption.currency)} each, go on sale on ${new Date(closing.registrationClosesAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" })}, for any seats left.`
      : null;

  const sessionDay = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/London",
    });
  const dates = coming.map((c) => ({
    id: c.id,
    label: sessionDay(c.startsAt),
    note:
      c.placesLeft > 0
        ? `${c.title ? `${c.title} · ` : ""}${c.placesLeft} seat${c.placesLeft === 1 ? "" : "s"} left`
        : "Fully booked",
    full: c.placesLeft <= 0,
  }));

  const choices: PackOption[] = options
    // The series is offered only while its run is open for registration; one
    // session, whenever a session is still to come.
    .filter((o) => ((o.credits ?? 1) > 1 ? seriesOnSale : sessionsOnSale))
    .map((o) => {
      const whole = (o.credits ?? 1) > 1;
      return {
        slug: o.slug,
        label: whole ? "The series" : "1 session",
        name: o.name,
        price: formatPrice(o.amount, o.currency),
        priceNote: whole ? `for all ${sessions} sessions` : "a session",
        detail: whole
          ? "A seat in every session. No booking needed"
          : `One session of ${series.name}, on the date you choose`,
        cta: { href: `/checkout?product=${o.slug}`, label: whole ? "Register for the series" : "Buy this session" },
        // A session is bought for a date, so it goes straight to checkout.
        cart: whole,
        ...(whole ? {} : { dates }),
      };
    });
  // Lead with the series: it is the whole offer.
  const initial = choices.find((o) => o.cart)?.slug ?? choices.at(-1)?.slug;

  const day = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });

  return (
    <OwnershipProvider resourceType="group_coaching_series" resourceId={series.id}>
      <BreadcrumbJsonLd
        trail={[
          { name: "Coaching", path: "/coaching" },
          { name: "Group Coaching", path: "/coaching/group-coaching" },
          {
            name: series.name,
            path: `/coaching/group-coaching/${series.slug}`,
          },
        ]}
      />
      <ProductHero
        backHref="/coaching/group-coaching"
        backLabel="All series"
        eyebrow="Group series"
        title={series.name}
        description={series.description}
        cover={{ path: series.storagePath }}
        price={fromPrice}
        priceNote={fromNote}
        status={status}
      />

      <ProductLayout
        aside={
          <PurchasePanel
            footnote={
              <>
                The series is sold first: register and your seat is kept in
                every session. When its registration closes, the seats left are
                sold as single sessions, for the date you choose. Group Coaching is also{" "}
                <Link href="/coaching/passes" className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  included with a Coaching Pass
                </Link>
                .
              </>
            }
          >
            {/* Booking a specific session is separate from holding the
                entitlement — payment ≠ entitlement ≠ booking (note 01 §11). */}
            <ViewerOwnedNotice deliveryHref="/academy/coaching" />
            <UnlessOwned>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not available to buy at the moment.</p>
              ) : onSale && choices.length > 0 ? (
                <>
                  {/* Begun: the series is closed to new people, its sessions are not. */}
                  {!seriesOnSale ? (
                    <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
                      {runs.some((r) => r.state === "in_progress")
                        ? "This series has begun, so the full series is closed to new people. You can join any session still to come."
                        : "Registration for the full series has closed. The seats left are sold as single sessions, for the date you choose."}
                    </p>
                  ) : null}
                  <PackPurchase label="What to buy" options={choices} initial={initial} />
                  {singlesLater ? (
                    <p className="mt-5 rounded-(--radius) border border-border bg-surface-muted/60 p-3 text-sm leading-relaxed">
                      {singlesLater}
                    </p>
                  ) : null}
                </>
              ) : (
                // Nothing is sold outside a registration period. Said in the
                // panel's own place, with the price still shown above.
                <div>
                  <p className="font-display text-2xl font-semibold">
                    {runs.some((r) => r.state === "full")
                      ? "Fully booked"
                      : next
                        ? `Registration opens ${day(next.registrationOpensAt)}`
                        : runs.some((r) => r.state === "in_progress" || r.state === "sessions")
                          ? "Closed"
                          : "Dates to be announced"}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {runs.some((r) => r.state === "full")
                      ? "Every place on this series has been taken. If another run opens, it will be listed here."
                      : next
                        ? `The series starts on ${day(next.startsAt)}. You can register for the full series from the date above until ${day(next.registrationClosesAt)}.${
                            next.passOpensAt !== next.registrationOpensAt
                              ? ` Coaching Pass holders can register from ${day(next.passOpensAt)}.`
                              : ""
                          }${
                            singleOption
                              ? ` Only want one session? Single sessions, ${formatPrice(singleOption.amount, singleOption.currency)} each, go on sale on ${day(next.registrationClosesAt)}, for any seats left.`
                              : ""
                          }`
                        : runs.some((r) => r.state === "in_progress")
                          ? "This series is in progress and closed: registration for the series has ended and every session still to come is fully booked. The next run will be listed here when its dates are set."
                          : runs.some((r) => r.state === "sessions")
                            ? "Registration for the series has closed and every session is fully booked. The next run will be listed here when its dates are set."
                            : "Registration opens before each series starts. Tony's letters carry the dates first."}
                  </p>
                  <div className="mt-5">
                    <NewsletterCta variant="primary" />
                  </div>
                </div>
              )}
            </UnlessOwned>
          </PurchasePanel>
        }
      >
        {/* The runs: when it is on, and whether it can be joined. A ruled
            list, one line a run — two only when a second has been opened. */}
        {runs.length > 0 ? (
          <ProductSection title="Dates">
            <ul className="max-w-2xl divide-y divide-border border-y border-border">
              {runs.map((run) => (
                <li key={run.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                  <div>
                    <p className="font-semibold">{run.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {day(run.startsAt)} to {day(run.endsAt)}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-medium", run.state === "open" ? "text-accent" : "text-muted-foreground")}>
                    {run.state === "open"
                      ? `Registration open · ${run.placesLeft} place${run.placesLeft === 1 ? "" : "s"} left`
                      : run.state === "full"
                        ? "Fully booked"
                        : run.state === "sessions"
                          ? sessionsOnSale
                            ? "Series registration closed · single sessions on sale"
                            : "Closed"
                          : run.state === "in_progress"
                            ? sessionsOnSale
                              ? "In progress · single sessions on sale"
                              : "In progress · closed"
                            : `Registration opens ${day(run.registrationOpensAt)}`}
                  </p>
                </li>
              ))}
            </ul>
          </ProductSection>
        ) : null}

        <ProductFacts
          facts={[
            { label: "Sessions", value: `${sessions}, one hour each` },
            { label: "Runs", value: "One session a week" },
            { label: "Group", value: `Up to ${series.capacity} people` },
            { label: "Where", value: "Online, live" },
          ]}
        />

        <ProductSection title="What's included">
          <CheckList
            items={[
              "Access to a live presentation from your mentor, by video conference",
              "A live Ask Me Anything, for your own questions",
              `A small group of no more than ${series.capacity} people, so there is time for everyone`,
              "In-depth guidance on the next step in your creative career",
              "Available as a gift: get in touch and we will set it up in their name",
            ]}
          />
        </ProductSection>

        {series.syllabus.length > 0 ? (
          <ProductSection title={`What the ${sessions} sessions cover`}>
            <CheckList items={series.syllabus} columns={2} />
          </ProductSection>
        ) : null}
      </ProductLayout>

      {options.length > 0 ? (
        <UnlessOwned>
          <MobileBuyBar price={fromPrice} priceNote={fromNote ?? undefined} href="#buy" label={seriesOnSale ? "Register" : onSale ? "Choose a date" : "See dates"} />
        </UnlessOwned>
      ) : null}
    </OwnershipProvider>
  );
}

/** Built on its first visit, then served from cache (note 10 §47.1). */
export function generateStaticParams() {
  return [];
}
