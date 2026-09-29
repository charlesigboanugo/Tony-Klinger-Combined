import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Band } from "@/components/layout/Band";
import { Container, Section } from "@/components/layout/Container";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { designPhotos } from "@/lib/site/design-photos";

/**
 * Public Academy landing — the only Academy page a guest may see (note 01 §8,
 * note 03 §18). Rendered inside the public masthead and footer (note 04 §9).
 *
 * A CENTRED hero over a faint full-bleed photograph, not a split: the owner
 * retired text-beside-photo heroes (2026-09-25). The photograph is the small
 * group after a talk — the room the Academy's live sessions happen in —
 * placed here once, per `design-photos.ts`.
 *
 * Unnumbered throughout (owner: no "01/02" labels); the three areas and the
 * three facts about access are cards.
 */
export function AcademyLanding() {
  return (
    <>
      <Band
        spacing="roomy"
        grain={false}
        backdrop={
          <div aria-hidden="true" className="absolute inset-0 -z-10">
            <Image
              src={designPhotos.homeCoaching.src}
              alt=""
              fill
              priority
              fetchPriority="high"
              quality={75}
              sizes="100vw"
              className="object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-linear-to-b from-block-noir/70 via-block-noir/80 to-block-noir" />
          </div>
        }
      >
        <div className="mx-auto max-w-3xl space-y-6 text-center">
          <Reveal>
            <Eyebrow align="center">The Academy</Eyebrow>
          </Reveal>
          <Reveal as="h1" delay={60} className="font-display text-balance">
            Where your learning lives
          </Reveal>
          <Reveal as="p" delay={120} className="mx-auto max-w-2xl text-xl leading-relaxed text-pretty text-block-foreground/85">
            Tony&apos;s courses, live cohort workshops and Group Coaching, all under one account,
            with your progress kept for you.
          </Reveal>
          <Reveal delay={180} className="flex flex-wrap justify-center gap-3 pt-2">
            <ButtonLink href="/auth/sign-in?next=%2Facademy" variant="onBlock" size="lg">
              Sign in
            </ButtonLink>
            <ButtonLink href="/coaching" variant="onBlockOutline" size="lg">
              See what&apos;s available
            </ButtonLink>
          </Reveal>
        </div>
      </Band>

      <Section>
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow align="center">Inside</Eyebrow>
            <h2 className="mt-4 font-display text-balance">Three ways to learn</h2>
          </div>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {AREAS.map((area, index) => (
              <Reveal
                as="li"
                key={area.title}
                delay={index * 70}
                className="group flex flex-col rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card transition-shadow hover:shadow-lift sm:p-7"
              >
                <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary">
                  {area.icon}
                </span>
                <h3 className="mt-5 font-display text-xl">{area.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{area.blurb}</p>
                <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                  {area.points.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={area.href} className="mt-6 text-sm font-medium text-accent underline-offset-4 hover:underline">
                  {area.cta} &rarr;
                </Link>
              </Reveal>
            ))}
          </ul>
        </Container>
      </Section>

      <Section className="bg-surface-muted">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-16">
            <div>
              <Eyebrow>How access works</Eyebrow>
              <h2 className="mt-4 font-display text-balance">Buy once, find it here</h2>
            </div>
            <ul className="grid gap-5 sm:grid-cols-3">
              {STEPS.map((s, index) => (
                <Reveal as="li" key={s.title} delay={index * 70} className="rounded-(--radius-lg) bg-surface p-6">
                  <h3 className="font-sans text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </Reveal>
              ))}
            </ul>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="flex flex-col items-center gap-6 rounded-(--radius-lg) bg-block-noir px-6 py-12 text-center text-block-foreground sm:px-10">
            <h2 className="max-w-2xl font-display text-balance">Already a member?</h2>
            <p className="max-w-xl text-block-foreground/80">
              Sign in to carry on where you left off. New here? Memberships include courses and
              coaching from the first day.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/auth/sign-in?next=%2Facademy" variant="onBlock">
                Sign in
              </ButtonLink>
              <ButtonLink href="/coaching/memberships" variant="onBlockOutline">
                Compare memberships
              </ButtonLink>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const AREAS = [
  {
    title: "Courses",
    blurb: "Self-paced lessons on how the film business really works, from first job to getting your movie made.",
    points: ["Video and written lessons", "Your progress, lesson by lesson", "Pick up exactly where you stopped"],
    href: "/coaching/courses",
    cta: "Browse courses",
    icon: icon(
      <>
        <rect x="3" y="5" width="18" height="13" rx="2" />
        <path d="m10 9 5 2.5-5 2.5z" />
      </>,
    ),
  },
  {
    title: "Cohorts",
    blurb: "A small, fixed group working through live workshops together over a set run of weeks.",
    points: ["Workshop schedule in one place", "Joining link on the day", "Recordings to go back to"],
    href: "/coaching/cohorts",
    cta: "Explore cohorts",
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M15 14.5c2.8 0 5 1.3 5 4.5" />
      </>,
    ),
  },
  {
    title: "Group Coaching",
    blurb: "Book seats in live sessions of eight at most, and bring your own project to the table.",
    points: ["Book with session credits", "Join from your Academy", "Replays of sessions you attend"],
    href: "/coaching/group-coaching",
    cta: "See Group Coaching",
    icon: icon(
      <>
        <path d="M4 5h16v10H9l-5 4z" />
        <path d="M8 9h8M8 12h5" />
      </>,
    ),
  },
];

const STEPS = [
  {
    title: "Choose what suits you",
    body: "A single course, a cohort place, coaching sessions, or a membership that bundles them.",
  },
  {
    title: "It appears straight away",
    body: "The moment payment clears, it's in your Academy, tied to your account, no codes to redeem.",
  },
  {
    title: "Learn at your own pace",
    body: "Lessons remember where you are; live sessions show a joining link when it's time.",
  },
];
