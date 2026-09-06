import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Welcome",
  // A one-time, session-bound page. There is nothing here for a search engine,
  // and indexing it would surface a page every visitor is bounced away from.
  robots: { index: false, follow: false },
};

/**
 * First-run orientation — note 03 §26, note 05 §7.1.
 *
 * Shown once, immediately after the first successful sign-in, whichever route
 * in was used. `claim_welcome()` has already run by the time anyone arrives
 * here, so this page itself is stateless and safe to reload or revisit — it
 * simply explains the platform and hands over to wherever the person was going.
 *
 * It is deliberately NOT a dead end. Someone who signed in on their way to buy
 * something is returned to that destination by the primary action.
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

  const orientation = [
    {
      title: "Everything you buy lives in the Academy",
      body: "Courses, recordings and workshop material appear there as soon as you have access to them. Nothing is unlocked yet.",
      href: "/academy",
      cta: "Open the Academy",
    },
    {
      title: "Coaching places are booked, not just bought",
      body: "Buying a session or a membership gives you the credit. Choosing a date reserves the place, and you can move it later.",
      href: "/bookings",
      cta: "See what's scheduled",
    },
    {
      title: "Your account holds the record",
      body: "Orders, access and membership are all listed there, along with your sign-in and security settings.",
      href: "/account",
      cta: "Go to your account",
    },
  ];

  return (
    <Section>
      <Container>
        <PageHeader
          title="Welcome to Tony Klinger"
          description={`You're signed in as ${context.email ?? "your new account"}. Here's how the site fits together.`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {orientation.map((item) => (
            <div
              key={item.title}
              className="flex flex-col rounded-(--radius) border border-border bg-surface p-5"
            >
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {item.body}
              </p>
              <Link
                href={item.href}
                className="mt-4 text-sm font-medium underline underline-offset-4 hover:text-accent"
              >
                {item.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <ButtonLink href={next}>Continue</ButtonLink>
          <p className="text-sm text-muted-foreground">
            We&apos;ve emailed you a copy of this — you can close it and come back
            any time.
          </p>
        </div>

        {context.isStaff ? (
          <div className="mt-8 rounded-(--radius) border border-border p-5">
            <p className="text-sm">
              This account holds a staff role, which requires a security key
              before the admin workspace will open.{" "}
              <Link href="/account/security" className="underline">
                Set that up now
              </Link>
              .
            </p>
          </div>
        ) : null}
      </Container>
    </Section>
  );
}
