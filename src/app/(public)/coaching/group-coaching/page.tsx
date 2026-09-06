import type { Metadata } from "next";

import { GeneratedCover } from "@/components/media/GeneratedCover";
import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { Reveal } from "@/components/motion/Reveal";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { listSeries } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Group Coaching",
  description:
    "Four series of eight sessions each — Filmmaking, Writing, Producing and For All Filmmakers.",
};

export default async function GroupCoachingPage() {
  const series = await listSeries();

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Coaching"
          title="Group Coaching"
          description="Small groups — up to eight people, one hour a session."
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            ["4", "series"],
            ["8", "sessions in each"],
            ["32", "sessions in total"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-(--radius) border border-border bg-surface p-5">
              <p className="text-3xl font-semibold">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {series.length === 0 ? (
          <EmptyState title="No series published yet" />
        ) : (
          /*
            NOT an OfferCard. Every other coaching listing uses one, but a
            series card carries its full eight-topic curriculum — which is what
            somebody deciding whether to spend £130 actually needs to see, and
            what note 07 §37.1 requires the listing to show. Squeezing that into
            the shared card would either truncate it or distort the card for
            every other page.
          */
          <ul className="grid gap-5 lg:grid-cols-2">
            {series.map((s, i) => (
              <Reveal as="li" key={s.id} delay={(i % 2) * 70} className="h-full">
                <Card interactive className="h-full">
                  <CardMedia ratio="16/9">
                    <GeneratedCover
                      title={s.name}
                      seed={s.slug}
                      eyebrow="Group series"
                      showTitle
                    />
                  </CardMedia>

                  <CardBody>
                    <CardTitle as="h2" className="text-xl">
                      <CardLink href={`/coaching/group-coaching/${s.slug}`}>
                        {s.name}
                      </CardLink>
                    </CardTitle>

                    {s.description ? (
                      <CardText className="mt-2">{s.description}</CardText>
                    ) : null}

                    {/* The curriculum, read from `syllabus` rather than parsed
                        out of description prose — so it cannot drift from the
                        stored fact (note 07 §37.1). */}
                    {s.syllabus.length > 0 ? (
                      <ol className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                        {s.syllabus.map((topic, n) => (
                          <li key={topic} className="flex gap-2.5">
                            <span className="shrink-0 tabular-nums text-primary">
                              {n + 1}.
                            </span>
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}

                    <p className="mt-4 border-t border-border pt-3 text-sm font-medium">
                      {s.syllabus.length > 0
                        ? `${s.syllabus.length} sessions`
                        : "8 sessions"}
                    </p>
                  </CardBody>
                </Card>
              </Reveal>
            ))}
          </ul>
        )}

        <p className="mt-8 max-w-2xl text-sm text-muted-foreground">
          A series is the programme; a session is one scheduled meeting within
          it. Buy a single session, an eight-session bundle, or reach them
          through membership.
        </p>
      </Container>
    </Section>
  );
}
