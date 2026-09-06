import type { Metadata } from "next";
import Link from "next/link";

import { Testimonials } from "@/components/content/Testimonials";
import { listTestimonials } from "@/lib/content/testimonials";
import { Container, Section } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";
import { formatPrice } from "@/lib/commerce/pricing";
import { listMembershipTiers } from "@/lib/content/coaching";

export const metadata: Metadata = {
  title: "Coaching",
  description:
    "Membership, courses, group coaching, cohorts, private coaching and retreats with Tony Klinger.",
};

const OFFERS = [
  {
    href: "/coaching/memberships",
    title: "Membership",
    blurb: "Four cumulative tiers. Each includes everything below it.",
    detail: "Recurring",
  },
  {
    href: "/coaching/courses",
    title: "Courses",
    blurb: "Structured, self-paced learning delivered in the Academy.",
    detail: "One-time purchase",
  },
  {
    href: "/coaching/group-coaching",
    title: "Group Coaching",
    blurb: "Four series of eight sessions, up to eight people in a room.",
    detail: "Session, bundle or membership",
  },
  {
    href: "/coaching/cohorts",
    title: "Interactive Cohorts",
    blurb: "Eight workshops of three hours — twenty-four hours together.",
    detail: "Fixed dates",
  },
  {
    href: "/coaching/private-coaching",
    title: "Private Coaching",
    blurb: "One to one, scheduled around you.",
    detail: "Booked",
  },
  {
    href: "/coaching/retreats",
    title: "Retreats",
    blurb: "Immersive, limited places, sometimes by application.",
    detail: "Limited",
  },
];

export default async function CoachingPage() {
  const tiers = await listMembershipTiers();

  const testimonials = await listTestimonials({ context: "coaching", limit: 6 });

  return (
    <>
      <Section className="border-b border-border">
        <Container>
          <div className="max-w-2xl space-y-5">
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Work with Tony
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">
              Six ways in, from a single coaching session to a full membership.
              Every one says plainly what you get, what it costs, and where it
              is delivered — before you buy.
            </p>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {OFFERS.map((offer) => (
              <li key={offer.href}>
                <Link
                  href={offer.href}
                  className="group flex h-full flex-col rounded-(--radius) border border-border bg-surface p-6 transition-colors hover:border-accent"
                >
                  <p className="text-xs tracking-wide text-muted-foreground uppercase">
                    {offer.detail}
                  </p>
                  <h2 className="mt-2 text-lg font-medium group-hover:text-accent">
                    {offer.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">{offer.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {tiers.length > 0 ? (
        <Section className="border-t border-border bg-surface">
          <Container>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight">Membership</h2>
                <p className="text-muted-foreground">
                  Silver through Ultimate. Each tier adds to the one before it —
                  they are steps, not alternatives.
                </p>
              </div>
              <ButtonLink href="/coaching/memberships">Compare tiers</ButtonLink>
            </div>

            <ol className="mt-8 flex flex-wrap items-center gap-2 text-sm">
              {tiers.map((tier, i) => (
                <li key={tier.id} className="flex items-center gap-2">
                  <span className="rounded-full border border-border bg-background px-3 py-1">
                    {tier.name}
                  </span>
                  {i < tiers.length - 1 ? (
                    <span aria-hidden="true" className="text-muted-foreground">→</span>
                  ) : null}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted-foreground">
              {formatPrice(null)} shown until pricing is configured.
            </p>
          </Container>
        </Section>
      ) : null}
      {testimonials.length > 0 ? (
        <Section className="border-t border-border bg-surface">
          <Container>
            <Testimonials
              testimonials={testimonials}
              heading="From people who have worked with Tony"
            />
          </Container>
        </Section>
      ) : null}

    </>
  );
}
