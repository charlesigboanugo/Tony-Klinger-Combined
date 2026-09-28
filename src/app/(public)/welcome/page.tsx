import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Container, Section } from "@/components/layout/Container";
import { Band } from "@/components/layout/Band";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/auth/safe-redirect";
import { requireUser } from "@/lib/permissions";
import { designPhotos } from "@/lib/site/design-photos";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Welcome",
  // A one-time, session-bound page. There is nothing here for a search engine,
  // and indexing it would surface a page every visitor is bounced away from.
  robots: { index: false, follow: false },
};

/**
 * First-run orientation — note 03 §26, note 05 §7.1, note 10 §42.3.
 *
 * Shown once, immediately after the first successful sign-in, whichever route
 * in was used. `claim_welcome()` has already run by the time anyone arrives
 * here, so this page itself is stateless and safe to reload or revisit — it
 * simply explains the platform and hands over to wherever the person was going.
 *
 * It is deliberately NOT a dead end, and it is short: a greeting with the one
 * action that matters (carry on), then three lines on where things live. The
 * primary action returns someone who signed in on their way to buy something
 * to that destination.
 *
 * Centred on noir with a small portrait, not a text-beside-photo split (owner,
 * 2026-09-26: no split heroes).
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const context = await requireUser("/welcome");
  const { next: rawNext } = await searchParams;

  // Validated like any other `next`, even though we generated it: it has
  // round-tripped through the address bar (note 05 §36).
  const next = safeRedirect(rawNext);
  const goingSomewhere = next !== DEFAULT_REDIRECT;

  // First name only, when one was given at sign-up. A greeting by full name
  // reads like a form letter.
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", context.userId)
    .maybeSingle();
  const firstName = profile?.display_name?.trim().split(/\s+/)[0];

  const portrait = designPhotos.welcome;

  const orientation: {
    icon: ReactNode;
    title: string;
    body: string;
    href: string;
    cta: string;
  }[] = [
    {
      icon: <LibraryIcon />,
      title: "Your library",
      body: "Courses, recordings and workshop material appear in the Academy the moment you have access.",
      href: "/academy",
      cta: "Open the Academy",
    },
    {
      icon: <CalendarIcon />,
      title: "Your sessions",
      body: "Coaching is booked, not just bought. Pick a date when you're ready, and move it later if you need to.",
      href: "/bookings",
      cta: "See the schedule",
    },
    {
      icon: <AccountIcon />,
      title: "Your account",
      body: "Orders, memberships and your sign-in and security settings, all in one place.",
      href: "/account",
      cta: "Go to your account",
    },
  ];

  return (
    <>
      {/* The portrait is too small to carry a caption under it, so its
          credit sits in the band's bottom-right corner (note 10 §42.3). */}
      <Band backdrop={<PhotoCredit src={portrait.src} variant="overlay" />}>
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center lg:pt-[max(0px,calc(var(--hero-text-top)-6rem))]">
          <Reveal>
            <div className="relative size-24 overflow-hidden rounded-full ring-1 ring-block-foreground/25 ring-offset-4 ring-offset-block-noir sm:size-28">
              <Image
                src={portrait.src}
                alt={portrait.alt}
                fill
                priority
                quality={90}
                sizes="112px"
                className={`object-cover ${portrait.focus}`}
              />
            </div>
          </Reveal>

          <Reveal delay={60} className="mt-8">
            <Eyebrow align="center">Welcome</Eyebrow>
          </Reveal>

          <Reveal as="h1" delay={100} className="mt-5">
            {firstName
              ? `Good to have you, ${firstName}.`
              : "Good to have you here."}
          </Reveal>

          <Reveal
            as="p"
            delay={140}
            className="mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85 text-pretty"
          >
            Everything you buy from Tony, from courses and coaching to
            membership, now lives in one account.
          </Reveal>

          <Reveal delay={180} className="mt-9">
            <ButtonLink href={next} variant="primary" size="lg">
              {goingSomewhere ? "Continue where you were" : "Start exploring"}
            </ButtonLink>
          </Reveal>
        </div>
      </Band>

      <Section className="py-16 sm:py-20">
        <Container>
          <Eyebrow align="center">Where things live</Eyebrow>

          <ul className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {orientation.map((item, i) => (
              <Reveal
                as="li"
                key={item.title}
                delay={i * 80}
                className="flex flex-col items-center text-center"
              >
                <span className="text-foreground">
                  {item.icon}
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold">
                  {item.title}
                </h3>
                <p className="mt-2 max-w-xs text-muted-foreground text-pretty">
                  {item.body}
                </p>
                <Link
                  href={item.href}
                  className="group mt-4 inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-primary/40 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
                >
                  {item.cta}
                  <span
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    &rarr;
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>

          {context.isStaff ? (
            <div className="mx-auto mt-14 max-w-2xl rounded-(--radius) border border-warning bg-warning/10 p-5 text-center text-sm">
              This account holds a staff role, which needs a security key before
              the admin workspace will open.{" "}
              <Link
                href="/account/security"
                className="font-semibold underline underline-offset-4 hover:text-accent"
              >
                Set that up now
              </Link>
              .
            </div>
          ) : null}
        </Container>
      </Section>
    </>
  );
}

/* Line icons, drawn at 32px on a 24 grid in the text colour: ink on the
   light ground, white in the dark theme. */

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function LibraryIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m10 9 5 3-5 3z" />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  );
}

function AccountIcon() {
  return (
    <Icon>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Icon>
  );
}
