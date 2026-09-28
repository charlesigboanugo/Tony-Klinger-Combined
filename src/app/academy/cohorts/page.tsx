import type { Metadata } from "next";

import { AccountHeader } from "@/components/account/AccountHeader";
import { CohortCard } from "@/components/academy/CohortCard";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { myCohorts } from "@/lib/academy";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cohorts", robots: { index: false } };

/**
 * Requires a session; content is entitlement-gated by RLS. Each card opens the
 * cohort's Academy page (`/academy/cohorts/[cohortSlug]`, note 07 §35) — its
 * schedule, joining links and recordings — rather than the public sales page.
 */
export default async function AcademyCohortsPage() {
  await requireUser("/academy/cohorts");
  const cohorts = await myCohorts();

  return (
    <>
      <AccountHeader title="Your cohorts" description="Workshop schedules, joining links and recordings." />

      {cohorts.length === 0 ? (
        <EmptyState icon="users"
          title="Nothing here yet"
          description="This fills in as soon as you have a place in a cohort."
          action={<ButtonLink href="/coaching/cohorts">Explore cohorts</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {cohorts.map((cohort, index) => (
            <Reveal as="li" key={cohort.id} delay={index * 60}>
              <CohortCard cohort={cohort} />
            </Reveal>
          ))}
        </ul>
      )}
    </>
  );
}
