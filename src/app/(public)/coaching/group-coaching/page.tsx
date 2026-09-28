import type { Metadata } from "next";

import { OfferCard } from "@/components/coaching/OfferCard";
import { OfferGrid } from "@/components/coaching/OfferGrid";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatPrice } from "@/lib/commerce/pricing";
import { listSeries, priceForProductSlug } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Group Coaching",
  description:
    "Four series of eight sessions each — Filmmaking, Writing, Producing and For All Filmmakers.",
};

export default async function GroupCoachingPage() {
  const [series, single, bundle] = await Promise.all([
    listSeries(),
    priceForProductSlug("group-coaching-single"),
    priceForProductSlug("group-coaching-x8"),
  ]);

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Group Coaching"
          description="Four series of eight one-hour sessions, up to eight people in each. Buy one session, a whole series, or reach them through membership."
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
            {series.map((s, i) => (
              <Reveal as="li" key={s.id} delay={(i % 2) * 70} className="h-full">
                <OfferCard
                  href={`/coaching/group-coaching/${s.slug}`}
                  title={s.name}
                  description={s.description}
                  eyebrow="Group series"
                  cta="View series"
                  priceLabel={single ? formatPrice(single.amount, single.currency) : null}
                  priceNote={single ? "a session" : null}
                  meta={
                    bundle
                      ? `All ${s.syllabus.length || 8} sessions for ${formatPrice(bundle.amount, bundle.currency)}`
                      : `${s.syllabus.length || 8} sessions`
                  }
                  storagePath={s.storagePath}
                  seed={s.slug}
                  priority={i < 2}
                >
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
            ))}
          </OfferGrid>
        )}

      </Container>
    </Section>
  );
}
