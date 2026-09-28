import Link from "next/link";
import type { ReactNode } from "react";

import { Container } from "@/components/layout/Container";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/utils/cn";

/**
 * Shared layout for the legal pages — note 03 §8.2, note 10 §9.
 *
 * Redesigned 2026-09-26 (owner: every public page to the site's standard). A
 * noir title band in the events page's vocabulary (no photo), then the
 * document: a plain-English summary first, a contents list that stays in
 * view beside the text from `lg`, and the sections at a reading measure.
 * Sections are not numbered (owner: no decorative numbering). The three
 * policies share this component so they cannot drift apart in style, and each
 * ends by pointing at the other two.
 *
 * `lastReviewed` is shown deliberately: a policy with no date gives a reader no
 * way to tell whether it is current.
 */

export type LegalSection = { id: string; title: string; body: ReactNode };

const POLICIES = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/cookies", label: "Cookies" },
];

export function LegalDocument({
  current,
  title,
  intro,
  lastReviewed,
  summary,
  sections,
}: {
  /** This page's own path, so the footer lists only the other policies. */
  current: "/privacy" | "/terms" | "/cookies";
  title: string;
  intro: string;
  lastReviewed: string;
  /** Three or four plain-English lines: the policy in short. */
  summary: string[];
  sections: LegalSection[];
}) {
  return (
    <>
      <section className="grain relative isolate overflow-hidden bg-block-noir text-block-foreground">
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -z-10 h-[150%] w-[min(70rem,150vw)] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--block-foreground)_12%,transparent),transparent_62%)]"
        />
        <Container className="pt-14 pb-14 text-center sm:pt-18 sm:pb-18 lg:pt-[max(3.5rem,calc(var(--hero-text-top)-1.5rem))] lg:pb-20">
          <Reveal className="mx-auto max-w-2xl">
            <Eyebrow align="center" className="text-block-foreground/80">The small print</Eyebrow>
            <h1 className="mt-5">{title}</h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-block-foreground/85 text-pretty">{intro}</p>
            <p className="mt-6 text-xs font-semibold tracking-[0.14em] text-block-foreground/65 uppercase">
              Last reviewed {lastReviewed}
            </p>
          </Reveal>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-20">
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-28">
              <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">On this page</p>
              <ol className="mt-4 space-y-2.5 border-l border-foreground/15 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px block border-l-2 border-transparent pl-4 leading-snug text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>

          <article className="max-w-2xl min-w-0">
            <aside aria-label="In short" className="rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card sm:p-8">
              <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">In short</p>
              <ul className="mt-4 space-y-3">
                {summary.map((line) => (
                  <li key={line} className="flex gap-3 leading-relaxed">
                    <span aria-hidden="true" className="mt-[0.7em] h-px w-4 shrink-0 bg-primary" />
                    {line}
                  </li>
                ))}
              </ul>
            </aside>

            <div
              className={cn(
                "mt-4 leading-relaxed",
                "[&_p]:mt-4 [&_p]:text-muted-foreground",
                "[&_ul]:mt-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:text-muted-foreground [&_ul]:marker:text-primary",
                "[&_dl]:mt-5 [&_dl]:divide-y [&_dl]:divide-border [&_dl]:border-y [&_dl]:border-border",
                "[&_dl>div]:grid [&_dl>div]:gap-1 [&_dl>div]:py-3.5 sm:[&_dl>div]:grid-cols-[10rem_minmax(0,1fr)] sm:[&_dl>div]:gap-6",
                "[&_dt]:font-semibold [&_dd]:text-muted-foreground",
                "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-accent",
                "[&_strong]:font-semibold [&_strong]:text-foreground",
              )}
            >
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={s.id} className="border-b border-border py-10 last:border-b-0">
                  <h2 id={s.id} className="scroll-mt-28 text-balance">
                    {s.title}
                  </h2>
                  {s.body}
                </section>
              ))}
            </div>

            <div className="mt-6 grid gap-6 rounded-(--radius-lg) bg-surface-muted p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-8">
              <div>
                <p className="font-display text-xl font-semibold">A question about this?</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Write to us and a person will answer.
                </p>
              </div>
              <ButtonLink href="/contact">
                Get in touch
                <ButtonArrow />
              </ButtonLink>
            </div>

            <p className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span>Also read:</span>
              {POLICIES.filter((p) => p.href !== current).map((p) => (
                <Link key={p.href} href={p.href} className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
                  {p.label}
                </Link>
              ))}
            </p>
          </article>
        </div>
      </Container>
    </>
  );
}
