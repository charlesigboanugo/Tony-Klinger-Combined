import type { Metadata } from "next";

import { AccountHeader } from "@/components/account/AccountHeader";
import { CohortCard } from "@/components/academy/CohortCard";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntakeChooser } from "@/app/academy/cohorts/IntakeChooser";
import { myCohorts } from "@/lib/academy";
import { myIntakeChoices } from "@/lib/academy/delivery";
import { academyStaffView, allCohorts } from "@/lib/academy/staff";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Cohorts", robots: { index: false } };

/**
 * Requires a session; content is entitlement-gated by RLS. Each card opens the
 * cohort's Academy page (`/academy/cohorts/[cohortSlug]`, note 07 §35) — its
 * schedule, joining links and recordings — rather than the public sales page.
 */
export default async function AcademyCohortsPage() {
  await requireUser("/academy/cohorts");
  const staffView = await academyStaffView();
  // Staff view (note 06 §23.2): every published cohort. A place of their own
  // still waiting for an intake is still theirs to choose.
  const [cohorts, choices] = await Promise.all([staffView ? allCohorts() : myCohorts(), myIntakeChoices()]);

  return (
    <>
      <AccountHeader
        title={staffView ? "Cohorts" : "Your cohorts"}
        description={staffView ? "Every published cohort, with its schedule and recordings." : "Workshop schedules, joining links and recordings."}
      />

      {/* A cohort paid for and not yet on an intake (migration 0017): choose
          it, or wait for the next intake to open. */}
      {choices.map((choice) => (
        <div
          key={choice.cohortName}
          className="mb-8 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6"
        >
          <p className="text-lg font-semibold">{choice.cohortName}: choose your intake</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {choice.intakes.length > 0
              ? "You have paid for a place. Pick the intake that suits you and your place is kept in every workshop."
              : "You have paid for a place. No intake is open for registration at the moment; it will appear here as soon as one is."}
          </p>
          {choice.intakes.length > 0 ? (
            <IntakeChooser
              intakes={choice.intakes.map((i) => ({
                id: i.id,
                label: i.label,
                dates: `${formatDate(i.startsAt)} to ${formatDate(i.endsAt)}`,
                places: i.placesLeft == null ? null : `${i.placesLeft} place${i.placesLeft === 1 ? "" : "s"} left`,
              }))}
            />
          ) : null}
        </div>
      ))}

      {cohorts.length === 0 && choices.length === 0 ? (
        <EmptyState icon="users"
          title="Nothing here yet"
          description="This fills in as soon as you have a place in a cohort."
          action={<ButtonLink href="/coaching/cohorts">Explore cohorts</ButtonLink>}
        />
      ) : cohorts.length === 0 ? null : (
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
