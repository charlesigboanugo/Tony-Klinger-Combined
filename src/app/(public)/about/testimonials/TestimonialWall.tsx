"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Carousel } from "@/components/motion/Carousel";
import { Reveal } from "@/components/motion/Reveal";
import { Eyebrow } from "@/components/ui/Eyebrow";
import type { Testimonial } from "@/lib/content/testimonials";
import { cn } from "@/lib/utils/cn";

/** How each `context` reads to a visitor. A context not listed is shown under "All" only. */
const FILTERS: { key: string; label: string }[] = [
  { key: "coaching", label: "Coaching" },
  { key: "courses", label: "Courses" },
  { key: "general", label: "Talks and press" },
];

/**
 * `?about=` narrows the wall in the browser, so the page itself can be
 * pre-built (note 10 §47.1). Rendered inside <Suspense>, whose fallback is the
 * unfiltered wall.
 */
export function FilteredWall({ all }: { all: Testimonial[] }) {
  return <TestimonialWall all={all} about={useSearchParams().get("about") ?? undefined} />;
}

/**
 * EVERY VOICE — the full set on one slider. Filters are a tab bar with counts.
 * Voices signed by name are set larger on the paper tone; survey voices stay
 * open on a hairline, so the wall has a rhythm rather than identical items.
 */
export function TestimonialWall({ all, about }: { all: Testimonial[]; about?: string }) {
  const active = FILTERS.some((f) => f.key === about) ? about : undefined;

  // Voices signed by name and survey voices alternate, so the slider mixes
  // the two rather than stacking every named voice at the front.
  const matching = all.filter((t) => !active || t.context === active);
  const signed = matching.filter((t) => t.attributed_to);
  const unsigned = matching.filter((t) => !t.attributed_to);
  const rest = Array.from({ length: Math.max(signed.length, unsigned.length) }).flatMap((_, n) =>
    [signed[n], unsigned[n]].filter((t): t is Testimonial => Boolean(t)),
  );

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, all.filter((t) => t.context === f.key).length]));

  return (
    <>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <Eyebrow>
            {rest.length} {rest.length === 1 ? "voice" : "voices"}
            {active ? ` · ${FILTERS.find((f) => f.key === active)?.label}` : null}
          </Eyebrow>
          <h2 id="voices-heading" className="mt-4 scroll-mt-28 font-display">Every voice</h2>
        </div>
        <nav aria-label="Filter testimonials" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-6 border-b border-foreground/15 sm:gap-8">
            {[{ key: undefined, label: "All" }, ...FILTERS].map((f) => {
              const current = f.key === active;
              const count = f.key ? counts[f.key] : all.length;
              if (f.key && !count) return null;
              return (
                <li key={f.label}>
                  <Link
                    href={f.key ? `/about/testimonials?about=${f.key}#voices-heading` : "/about/testimonials#voices-heading"}
                    scroll={false}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "-mb-px inline-flex items-baseline gap-2 border-b-2 pb-3 text-sm font-medium transition-colors",
                      current
                        ? "border-accent text-foreground"
                        : "border-transparent text-muted-foreground hover:border-accent/50 hover:text-accent",
                    )}
                  >
                    {f.label}
                    <sup className={cn("text-[0.6875rem] tabular-nums", current ? "text-accent" : "text-muted-foreground")}>
                      {count}
                    </sup>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Two at a time from md, one on a phone, sliding on the shared
          Carousel (owner, 2026-09-26: the three-column wall was too
          clustered). Keyed by the filter so a new set starts from its first. */}
      <Reveal>
        <Carousel
          key={active ?? "all"}
          label="Written testimonials"
          interval={7000}
          className="mt-14"
          trackClassName="-mx-4"
          slideClassName="w-full px-4 md:w-1/2"
        >
          {rest.map((t) => (
            <Quote key={t.id} testimonial={t} />
          ))}
        </Carousel>
      </Reveal>
    </>
  );
}

/** How a `context` is named on a quote. */
const CONTEXT_LABEL: Record<string, string> = Object.fromEntries(FILTERS.map((f) => [f.key, f.label]));

/** "Francesca Lilleystone" → "FL". */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * One voice. Type steps down as the quote grows, so a short remark is set like
 * a headline and a paragraph like a letter. The monogram is the person's
 * initials, or a quote mark for an anonymous voice.
 */
function Quote({ testimonial: t }: { testimonial: Testimonial }) {
  const named = Boolean(t.attributed_to);
  const size =
    t.quote.length < 90
      ? named ? "text-2xl leading-snug" : "text-xl leading-snug"
      : t.quote.length < 200
        ? named ? "text-xl leading-snug" : "text-lg leading-snug"
        : named ? "text-lg leading-relaxed" : "text-base leading-relaxed";
  const about = t.context ? CONTEXT_LABEL[t.context] : undefined;

  return (
    <figure
      className={cn(
        "flex h-full flex-col rounded-sm p-7 sm:p-9",
        named ? "bg-surface-muted" : "border border-foreground/15",
      )}
    >
      {about ? (
        <p className="mb-4 flex items-center gap-3 text-[0.625rem] font-semibold tracking-[0.2em] text-current/70 uppercase"><span aria-hidden="true" className="h-px w-6 bg-primary" />{about}</p>
      ) : null}
      <blockquote className={cn("font-medium text-pretty", size)}>
        <span aria-hidden="true" className="mr-1 text-primary">&ldquo;</span>
        {t.quote}
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3 pt-6">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold",
            named ? "bg-button text-button-foreground" : "border border-foreground/20 text-primary",
          )}
        >
          {named ? initials(t.attributed_to!) : <span className="text-xl leading-none">&ldquo;</span>}
        </span>
        <span className="min-w-0 text-sm leading-snug">
          {t.attributed_to ? <span className="block font-semibold">{t.attributed_to}</span> : null}
          {t.attribution_detail ? (
            <span className="block text-muted-foreground">{t.attribution_detail}</span>
          ) : null}
        </span>
      </figcaption>
    </figure>
  );
}
