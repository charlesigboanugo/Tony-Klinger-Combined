import Link from "next/link";

import { NewsletterButton } from "@/components/content/NewsletterPopup";
import { Container } from "@/components/layout/Container";
import { Wordmark } from "@/components/navigation/Wordmark";
import { footerColumns, legalNavigation } from "@/lib/navigation";

/**
 * Public footer — note 04 §8, note 10 §42.2.
 *
 * ONE BAND, NOT FIVE. An earlier version stacked a closing slogan with two
 * buttons, a full-width newsletter block, every submenu as columns, a signature
 * and a bottom line — nearly a screen of footer, most of it boilerplate. Now:
 *
 *   left    the mark, one line, and the newsletter as a single underlined field
 *   right   three short, curated columns (`footerColumns`)
 *   below   the name as a quiet signature, then the legal line
 *
 * On the ink field (`on-ink` re-points the tokens), so the newsletter form and
 * links render correctly on dark without variants of their own. Carries the
 * legal routes (note 03 §8.2).
 */
export function PublicFooter() {
  return (
    <footer className="on-ink grain relative isolate mt-auto overflow-hidden">
      <Container width="wide">
        {/* `grid-cols-1` is load-bearing: with no declared columns the single
            implicit track is sized to its content, not the screen, so the
            email field and button stretched the column to 448px on a 320px
            phone and the footer's overflow-hidden silently cropped it. */}
        <div className="grid grid-cols-1 gap-12 pt-14 pb-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20 lg:pt-16">
          {/* Two distinct things share this column — who Tony is, and an
              invitation to sign up — so they are set apart: the identity in the
              display face, the newsletter as one ruled line beneath it. */}
          <div className="max-w-md">
            <Wordmark />
            <p className="mt-6 font-normal text-xl leading-snug text-pretty text-foreground/90 italic">
              Films, books and coaching from inside the business.
            </p>
            {/* One line and a button, not the whole form: the form opens in a
                popup (NewsletterPopup), which kept the footer short. */}
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-6">
              <p className="text-sm text-muted-foreground">Letters from Tony, a few times a year.</p>
              <NewsletterButton className="text-sm font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-[6px] transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {footerColumns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <p className="mb-4 text-[0.6875rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                  {column.title}
                </p>
                <ul className="space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground/85 underline-offset-4 transition-colors hover:text-foreground hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </Container>

      {/* The signature: the name across the width, quiet and cropped by the rule below. */}
      <p
        aria-hidden="true"
        className="pointer-events-none mb-[-0.16em] px-2 text-center font-display text-[12.5vw] leading-[0.8] font-semibold tracking-[-0.045em] whitespace-nowrap text-foreground/[0.07] select-none"
      >
        Tony Klinger
      </p>

      <div className="relative border-t border-border">
        <Container width="wide">
          <div className="flex flex-col gap-3 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Tony Klinger. All rights reserved.</p>
            <ul className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {legalNavigation.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="#main" className="font-semibold tracking-[0.18em] text-foreground uppercase hover:text-primary">
                  Back to top &uarr;
                </a>
              </li>
            </ul>
          </div>
        </Container>
      </div>
    </footer>
  );
}
