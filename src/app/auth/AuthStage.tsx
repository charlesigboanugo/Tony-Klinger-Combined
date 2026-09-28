import Image from "next/image";
import type { CSSProperties } from "react";

import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Wordmark } from "@/components/navigation/Wordmark";
import { designPhotos } from "@/lib/site/design-photos";
import { cn } from "@/lib/utils/cn";

/**
 * The stage beside every auth form — note 04 §17, §33; note 10 §42.3.
 *
 * "Branding + focused authentication content": the branding is this panel,
 * the focus is the form column beside it, which carries nothing else. It uses
 * the home title card's vocabulary — the noir field, film grain, the drifting
 * oxblood light leak, a photo that settles in like a slow camera — so signing
 * in feels like part of the same production rather than a vendor screen.
 *
 * It lives in the LAYOUT, so moving between sign-in, sign-up and reset keeps
 * the stage still and only the form changes: the photo does not reload and the
 * entrance does not replay on every hop.
 *
 * On phones it collapses to a short band holding the wordmark, so the form
 * starts well above the fold; the line and the figures appear from `lg`.
 */

/** Stated in the About copy, like the home credits line — nothing invented. */
const figures = [
  { figure: "60", unit: "yrs", label: "In film and television" },
  { figure: "100", unit: "+", label: "Films made worldwide" },
  { figure: "30", unit: "+", label: "Countries produced in" },
];

const beat = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

export function AuthStage() {
  const photo = designPhotos.auth;

  return (
    <div className="grain relative isolate h-44 overflow-hidden bg-block-noir text-block-foreground sm:h-56 lg:sticky lg:top-0 lg:h-svh">
      <figure className="absolute inset-0 -z-10">
        <div className="absolute inset-0 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            quality={88}
            sizes="(min-width: 1024px) 50vw, 100vw"
            className={cn("object-cover", photo.focus)}
          />
        </div>
        {/* Noir at the head for the wordmark and at the foot for the words;
            the photo keeps its warmth through the middle. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-b from-block-noir/75 via-block-noir/10 via-40% to-block-noir lg:via-block-noir/5 lg:via-30%"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 hidden h-[55%] bg-linear-to-t from-block-noir from-25% to-transparent lg:block"
        />
      </figure>

      {/* The projector's light leak from the home hero. Decoration only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-20%] left-[-25%] -z-10 aspect-square w-[80%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--block-oxblood)_85%,transparent),transparent)] opacity-60 blur-3xl animate-[leak-drift_22s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
      />

      <div className="relative flex h-full flex-col px-4 pt-5 pb-6 sm:px-8 sm:pt-7 lg:px-10 lg:pt-10 lg:pb-16 xl:px-14">
        <Wordmark compact className="self-start text-block-foreground" />

        <div className="mt-auto hidden max-w-xl lg:block">
          <p
            className="flex items-center gap-4 text-xs font-semibold tracking-[0.24em] text-block-foreground/75 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(200)}
          >
            <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
            Producer &middot; Author &middot; Coach
          </p>

          {/* The site's line, set as a title card. A paragraph, not a heading:
              the page's one h1 is the form's title. */}
          <p className="mt-6 font-display text-[clamp(2.25rem,0.5rem+3vw,4rem)] leading-[0.98] font-semibold tracking-[-0.03em]">
            {[
              { text: "Six decades in film," },
              { text: "put to work", italic: true },
              { text: "for you." },
            ].map((line, i) => (
              <span key={line.text} className="mb-[-0.1em] block overflow-hidden pb-[0.1em]">
                <span
                  className={cn(
                    "block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none",
                    line.italic &&
                      "font-normal text-[color-mix(in_oklab,var(--block-foreground)_70%,var(--block-oxblood))] italic",
                  )}
                  style={beat(280 + i * 110)}
                >
                  {line.text}
                </span>
              </span>
            ))}
          </p>

          <dl
            className="mt-10 grid grid-cols-3 gap-4 border-t border-block-foreground/15 pt-6 animate-[fade-up_1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(760)}
          >
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col">
                <dt className="order-2 mt-2 text-xs leading-snug text-block-foreground/70">{f.label}</dt>
                <dd className="order-1 font-display text-3xl leading-none xl:text-4xl font-semibold tabular-nums">
                  {f.figure}
                  <span className="ml-0.5 text-lg font-normal text-block-foreground/70">{f.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <PhotoCredit src={photo.src} variant="overlay" />
    </div>
  );
}
