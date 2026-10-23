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
 * THE WORDS NEVER SIT ON TONY'S FACE (owner, 2026-10-13). From `lg` the
 * photo fills the whole panel, and it is chosen and cropped so his head is in
 * the upper half: the wordmark is in the empty corner beside it and the line
 * falls across his shirt and folded arms, under a noir fade. An earlier frame
 * had his face mid-panel, which put the line across his mouth.
 *
 * It lives in the LAYOUT, so moving between sign-in, sign-up and reset keeps
 * the stage still and only the form changes: the photo does not reload and the
 * entrance does not replay on every hop.
 *
 * Below `lg` the stage is the wordmark on noir and a short photo band under
 * it, so nothing overlaps there either and the form starts above the fold;
 * the line and the figures appear from `lg`. The figures step aside on short
 * screens, so the line stays clear of his face.
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
    <div className="grain relative isolate flex flex-col overflow-hidden bg-block-noir text-block-foreground lg:sticky lg:top-0 lg:h-svh">
      <div className="px-4 pt-5 pb-4 sm:px-8 sm:pt-7 sm:pb-5 lg:px-10 lg:pt-10 lg:pb-8 xl:px-14">
        <Wordmark compact className="text-block-foreground" />
      </div>

      {/* Full width on phones, the whole panel from `lg`. In between, the
          band is too wide and shallow to hold his whole head, so the photo
          narrows to a frame that does and its sides dissolve into the noir. */}
      <figure className="relative h-44 w-full shrink-0 overflow-hidden sm:mx-auto sm:mb-6 sm:h-64 sm:max-w-xl sm:max-lg:mask-[linear-gradient(to_right,transparent,black_16%,black_84%,transparent)] lg:absolute lg:inset-0 lg:-z-10 lg:mb-0 lg:h-auto lg:max-w-none">
        <div className="absolute inset-0 animate-[settle_2.6s_var(--ease-out-expo)_both] motion-reduce:animate-none">
          <Image
            src={photo.src}
            alt={photo.alt}
            fill
            priority
            fetchPriority="high"
            quality={88}
            // From `lg` the landscape frame covers a tall panel, so it is drawn
            // wider than the panel: one and a half times the screen's height.
            sizes="(min-width: 1024px) max(50vw, 150vh), 100vw"
            className={cn("object-cover", photo.focus)}
          />
        </div>
        {/* Noir at the head for the wordmark and at the foot for the words;
            his face, in between, is left clear. */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 hidden h-48 bg-linear-to-b from-block-noir/70 to-transparent lg:block"
        />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 hidden h-[64%] bg-linear-to-t from-block-noir from-30% via-block-noir/55 via-65% to-transparent lg:block"
        />
        <PhotoCredit src={photo.src} variant="overlay" />
      </figure>

      {/* The projector's light leak from the home hero. Decoration only. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-20%] left-[-25%] -z-10 aspect-square w-[80%] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--block-oxblood)_85%,transparent),transparent)] opacity-60 blur-3xl animate-[leak-drift_22s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
      />

      <div className="mt-auto hidden px-10 pb-24 lg:block xl:px-14 [@media(max-height:52rem)]:pb-14">
        <div className="max-w-xl">
          <p
            className="flex items-center gap-4 text-xs font-semibold tracking-[0.24em] text-block-foreground/75 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={beat(200)}
          >
            <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
            Producer &middot; Author &middot; Coach
          </p>

          {/* The site's line, set as a title card. A paragraph, not a heading:
              the page's one h1 is the form's title. */}
          <p className="mt-5 font-display text-[clamp(2.25rem,0.5rem+3vw,3.5rem)] leading-[0.98] font-semibold tracking-[-0.03em]">
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
            className="mt-8 grid grid-cols-3 gap-4 border-t border-block-foreground/15 pt-6 [@media(max-height:52rem)]:hidden animate-[fade-up_1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
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
    </div>
  );
}
