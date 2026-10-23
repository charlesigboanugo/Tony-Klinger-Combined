import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { phaseStatus } from "@/lib/content/offer-status";
import { formatPrice } from "@/lib/commerce/pricing";
import { optionGroup } from "@/lib/commerce/options";
import { listComingSessions, listRuns, listSeries } from "@/lib/content/coaching";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Group Coaching",
  description:
    "Live Group Coaching with Tony Klinger in small groups: Filmmaking, Writing, Producing and For All Filmmakers.",
  path: "/coaching/group-coaching",
});

export default async function GroupCoachingPage() {
  const series = await listSeries();

  // Each series has its own two products (migration 0014). They are priced
  // alike, so the first series' pair stands for the figures on every card.
  const options = series[0] ? await optionGroup(`group-coaching-${series[0].slug}`) : [];
  const single = options.find((o) => (o.credits ?? 1) === 1) ?? null;
  const whole = options.find((o) => (o.credits ?? 1) > 1) ?? null;

  // When each series is next on (migration 0016): the run open for
  // registration, else the one coming, else the one under way.
  const runs = await listRuns(series.map((s) => s.id));
  const day = (value: string) =>
    new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });
  // When it is on, as the chip on the card's photograph; and the run's dates
  // as the quieter line at its foot.
  const seatsLeft = new Map(
    await Promise.all(
      series.map(async (item) => [item.id, (await listComingSessions(item.id)).filter((c) => c.placesLeft > 0).length] as const),
    ),
  );
  const statusOf = (seriesId: string) =>
    phaseStatus(
      runs.filter((r) => r.seriesId === seriesId),
      { singleSessionsLeft: seatsLeft.get(seriesId) ?? 0 },
    );
  const datesOf = (seriesId: string) => {
    const run = runs.find((r) => r.seriesId === seriesId);
    return run ? `${run.label} · ${day(run.startsAt)} to ${day(run.endsAt)}` : null;
  };

  /*
    THE PRICE ON A CARD IS FOR WHAT IS ON SALE (owner, 2026-10-09). The series
    is sold first and single sessions after, never together (migrations 0024,
    0025), so "£25 a session" on a series that can only be bought whole, for
    £130, was misleading. A card shows the series price while the series is
    what is sold (or next to be), and the session price once its sessions are.
    While the series is on sale it also says when single sessions follow, so
    somebody who wants only one knows it is coming.
  */
  const offerOf = (seriesId: string) => {
    const mine = runs.filter((r) => r.seriesId === seriesId);
    // A closed series has nothing to buy, so it shows no price (owner,
    // 2026-10-09): a figure beside "closed" reads as an offer.
    if (statusOf(seriesId).tone === "closed") return { price: null, note: null, later: null };
    const selling = mine.find((r) => r.state === "open" || r.state === "full" || r.state === "upcoming");
    // Its sessions are on sale: the series has closed and one still has a seat.
    const singles = !selling && (seatsLeft.get(seriesId) ?? 0) > 0;
    if (singles && single) {
      return { price: formatPrice(single.amount, single.currency), note: "a session", later: null };
    }
    const shown = whole ?? single;
    return {
      price: shown ? formatPrice(shown.amount, shown.currency) : null,
      note: shown ? (whole ? "the series" : "a session") : null,
      later:
        selling && single && whole
          ? // The date they open, not "when the series starts": it may be earlier.
            `Single sessions, ${formatPrice(single.amount, single.currency)} each, go on sale on ${day(selling.registrationClosesAt)}, for any seats left.`
          : null,
    };
  };

  // Group size is set per series in admin. Stated in the header only when every
  // series agrees; otherwise each series' own page says its own.
  const sizes = [...new Set(series.map((s) => s.capacity))];
  const groupSize = sizes.length === 1 ? `, with no more than ${sizes[0]} people in each` : "";

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Group Coaching"
          description={`Live, hour-long sessions in small groups${groupSize}. Each series runs for eight weeks, one session a week. The full series is sold first; once its registration closes, any seats left are sold as single sessions. A series is also included with a Coaching Pass.`}
        />

        {series.length === 0 ? (
          <EmptyState title="No series published yet" />
        ) : (
          /*
            The shared OfferCard, with the series' eight-topic curriculum in
            its body — what somebody deciding whether to spend £130 needs to
            see (note 07 §37.1). A series has no product of its own: every
            series sells through the same two, a single session and all
            eight, so both prices are on every card.
          */
          <OfferGrid count={series.length}>
            {series.map((s, i) => {
              const offer = offerOf(s.id);
              return (
              <Reveal as="li" key={s.id} delay={(i % 2) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/group-coaching/${s.slug}`}
                  title={s.name}
                  description={s.description}
                  eyebrow="Group series"
                  cta="View series"
                  priceLabel={offer.price}
                  priceNote={offer.note}
                  status={statusOf(s.id)}
                  meta={datesOf(s.id)}
                  storagePath={s.storagePath}
                  seed={s.slug}
                  priority={i < 2}
                >
                  {/* For somebody who wants one session, not eight. */}
                  {offer.later ? <p className="mt-4 text-sm text-block-foreground/75">{offer.later}</p> : null}
                  {/* The curriculum, read from `syllabus` rather than parsed
                      out of description prose (note 07 §37.1). */}
                  {s.syllabus.length > 0 ? (
                    <ul className="mt-5 grid gap-x-6 gap-y-1.5 border-t border-block-foreground/15 pt-5 text-sm text-block-foreground/75 sm:grid-cols-2">
                      {s.syllabus.map((topic) => (
                        <li key={topic} className="flex gap-2.5">
                          <span aria-hidden="true" className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-block-foreground" />
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </OfferCard>
              </Reveal>
              );
            })}
          </OfferGrid>
        )}

      </Container>
    </Section>
  );
}
