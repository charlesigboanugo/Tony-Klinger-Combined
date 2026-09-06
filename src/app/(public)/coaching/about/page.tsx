import type { Metadata } from "next";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";

export const metadata: Metadata = {
  title: "How coaching works",
  description: "How Tony Klinger's coaching, membership and delivery fit together.",
};

const STEPS = [
  ["Choose", "Pick a course, series, cohort, retreat or membership tier."],
  ["Purchase", "Pay once, or subscribe. Guest checkout is fine — an account can come after."],
  ["Access", "What you bought becomes an entitlement attached to your account."],
  ["Book", "Where a service is scheduled, book a slot using that entitlement."],
  ["Attend", "Sessions, workshops and course content are delivered in the Academy."],
];

export default function CoachingAboutPage() {
  return (
    <Section>
      <Container width="narrow">
        <PageHeader
          title="How it works"
          description="From choosing something to actually attending it."
        />

        <ol className="space-y-4">
          {STEPS.map(([title, body], i) => (
            <li
              key={title}
              className="flex gap-4 rounded-(--radius) border border-border bg-surface p-5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-(--radius) border border-border p-5">
          <p className="text-sm text-muted-foreground">
            Paying, having access, and having a place booked are three different
            things. That is why an existing membership is recognised before any
            second charge is made — if what you are booking is already covered,
            you are not asked to pay for it again.
          </p>
        </div>
      </Container>
    </Section>
  );
}
