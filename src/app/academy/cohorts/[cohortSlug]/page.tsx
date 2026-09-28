import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountSection } from "@/components/account/AccountHeader";
import { DateBadge, JoinAction, RecordingAction } from "@/components/academy/SessionParts";
import { StoredImage } from "@/components/media/StoredImage";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cohortBySlug } from "@/lib/academy/delivery";
import { formatSlot } from "@/lib/academy/format";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";

export async function generateMetadata({
  params,
}: PageProps<"/academy/cohorts/[cohortSlug]">): Promise<Metadata> {
  const { cohortSlug } = await params;
  const cohort = await cohortBySlug(cohortSlug);
  return { title: cohort?.name ?? "Cohort", robots: { index: false } };
}

/**
 * A cohort, delivered — note 07 §35.
 *
 * The public page (`/coaching/cohorts/[slug]`) sells the cohort; this one runs
 * it for the people in it: the next workshop and its joining link, the rest of
 * the schedule, recordings of what has happened, and what the place includes.
 * Before this route existed the Academy's cohort cards linked out to the sales
 * page, so a member who had paid was shown the pitch again and nothing else.
 */
export default async function AcademyCohortPage({
  params,
}: PageProps<"/academy/cohorts/[cohortSlug]">) {
  const { cohortSlug } = await params;
  await requireUser(`/academy/cohorts/${cohortSlug}`);

  const cohort = await cohortBySlug(cohortSlug);
  if (!cohort) notFound();

  const level = `${cohort.cohortLevel[0].toUpperCase()}${cohort.cohortLevel.slice(1)}`;
  const runs =
    cohort.startsAt && cohort.endsAt
      ? `${formatDate(cohort.startsAt)} – ${formatDate(cohort.endsAt)}`
      : cohort.startsAt
        ? `Starts ${formatDate(cohort.startsAt)}`
        : "Dates to be announced";

  const hero = (
    <section className="relative isolate overflow-hidden rounded-(--radius-lg) bg-block-noir p-6 text-block-foreground shadow-lift sm:p-10">
      {cohort.storagePath ? (
        <div aria-hidden="true" className="absolute inset-y-0 right-0 -z-10 w-full sm:w-2/3">
          <StoredImage path={cohort.storagePath} alt="" fill sizes="(min-width: 640px) 60vw, 100vw" className="opacity-35" />
          <div className="absolute inset-0 bg-linear-to-r from-block-noir via-block-noir/85 to-block-noir/30" />
        </div>
      ) : null}
      <Eyebrow>{level} cohort</Eyebrow>
      <h1 className="mt-4 max-w-3xl font-display text-balance">{cohort.name}</h1>
      {cohort.description ? (
        <p className="measure mt-4 text-lg leading-relaxed text-block-foreground/80 text-pretty">
          {cohort.description}
        </p>
      ) : null}
      <p className="mt-5 text-sm text-block-foreground/70">{runs}</p>
      {!cohort.entitled ? (
        <div className="mt-7 flex flex-wrap gap-3">
          <ButtonLink href={`/coaching/cohorts/${cohort.slug}`} variant="onBlock">
            See this cohort
          </ButtonLink>
        </div>
      ) : null}
    </section>
  );

  if (!cohort.entitled) {
    return (
      <>
        <BackLink href="/academy/cohorts">Your cohorts</BackLink>
        {hero}
        <p className="mt-6 text-sm text-muted-foreground">
          You don&apos;t hold a place in this cohort, so its schedule and recordings aren&apos;t
          shown here.
        </p>
      </>
    );
  }

  const [next, ...later] = cohort.upcoming;

  return (
    <>
      <BackLink href="/academy/cohorts">Your cohorts</BackLink>
      {hero}

      <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-10">
        <div className="min-w-0 space-y-12">
          <AccountSection title="Next workshop">
            {next ? (
              <div className="flex flex-col gap-5 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:p-6">
                <DateBadge value={next.startsAt} large />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-xl font-semibold text-balance">{next.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{formatSlot(next.startsAt, next.endsAt)}</p>
                </div>
                <JoinAction join={next.join} />
              </div>
            ) : (
              <div className="rounded-(--radius-lg) border border-dashed border-border p-6 text-center">
                <p className="font-medium">
                  {cohort.past.length ? "No more workshops scheduled" : "The schedule is on its way"}
                </p>
                <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
                  {cohort.past.length
                    ? "Every workshop has run. The recordings stay here for you below."
                    : "Workshop dates appear here as soon as they're set, with a joining link on the day."}
                </p>
              </div>
            )}
          </AccountSection>

          {later.length ? (
            <AccountSection title="Coming up">
              <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {later.map((w) => (
                  <li key={w.id} className="flex items-center gap-4 p-4">
                    <DateBadge value={w.startsAt} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{w.title}</p>
                      <p className="text-sm text-muted-foreground">{formatSlot(w.startsAt, w.endsAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}

          {cohort.past.length ? (
            <AccountSection title="Recordings">
              <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
                {cohort.past.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{w.title}</p>
                      <p className="text-sm text-muted-foreground">{formatSlot(w.startsAt)}</p>
                    </div>
                    <RecordingAction recording={w.recording} />
                  </li>
                ))}
              </ul>
            </AccountSection>
          ) : null}
        </div>

        <aside className="space-y-6">
          {cohort.benefits.length ? (
            <div className="rounded-(--radius-lg) border border-border bg-surface p-5">
              <h2 className="font-sans text-sm font-semibold">Your place includes</h2>
              <ul className="mt-4 space-y-3">
                {cohort.benefits.map((b) => (
                  <li key={b} className="flex gap-3 text-sm">
                    <span aria-hidden="true" className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-accent/12 text-accent">
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                        <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-pretty">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="rounded-(--radius-lg) border border-border p-5 text-sm">
            <p className="font-semibold">Need a hand?</p>
            <p className="mt-1.5 text-muted-foreground">
              Questions about the cohort or a workshop time?{" "}
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                Get in touch
              </Link>
              .
            </p>
            <Link
              href={`/coaching/cohorts/${cohort.slug}`}
              className="mt-3 inline-block font-medium text-accent underline-offset-4 hover:underline"
            >
              Full cohort details
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
