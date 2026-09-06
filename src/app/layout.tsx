import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import "./globals.css";

/**
 * Root layout — genuinely global concerns only (note 02 §7, note 04 §28).
 *
 * The public header and footer deliberately live in `(public)/layout.tsx`, not
 * here. Putting them here would push the marketing chrome into Academy, Admin,
 * Checkout and Auth, which is exactly what the workspace layouts exist to avoid.
 */

/**
 * Two faces, each doing one job (note 10 §8).
 *
 * Fraunces carries the editorial voice — a variable serif with real optical
 * sizing, so a 72px headline is drawn with the thin hairlines a display cut
 * needs while a 20px subhead stays sturdy. One face covering both sizes is
 * what makes headings look either weedy or clumsy.
 *
 * Manrope sets everything else. It is a geometric grotesk with enough
 * character to avoid the system-font-stack look, and its tall x-height keeps
 * long descriptions readable at small sizes.
 *
 * Both are variable fonts, so the whole weight range costs one file each
 * rather than one request per weight.
 */
const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  /*
    ONLY the optical-size axis.
    
    `opsz` is the one that earns its bytes: it is what lets a 72px headline be
    drawn with true display hairlines while a 20px subhead stays sturdy, which
    is the whole reason this face was chosen. SOFT and WONK are stylistic
    axes this design never varies, and every unused axis is carried in the
    variable font's payload on EVERY page — measured at 142KB of font before
    trimming, the single largest fixed cost on the site.
  */
  axes: ["opsz"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Tony Klinger",
    template: "%s | Tony Klinger",
  },
  description:
    "Film producer, author and coach. Courses, coaching, cohorts and retreats for filmmakers and writers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {/*
          Skip link — WCAG 2.4.1.
          Every page repeats the same header and navigation. Without this, a
          keyboard or screen-reader user tabs through all of it on EVERY page
          before reaching the content they came for. Visually hidden until
          focused, then the first thing Tab reveals.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-(--radius) focus:bg-button focus:px-4 focus:py-2 focus:text-button-foreground"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
