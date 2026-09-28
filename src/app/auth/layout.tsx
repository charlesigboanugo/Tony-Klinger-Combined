import Link from "next/link";

import { AuthStage } from "@/app/auth/AuthStage";

/**
 * Auth layout — minimal, task-focused (note 04 §17, §33; note 03 §31).
 *
 * A split screen: the noir stage (brand, photo, the line) on the left, the
 * form alone on the paper ground on the right. On phones the stage is a short
 * band above the form.
 *
 * The full public menu is deliberately absent: the user is completing one task.
 * The wordmark on the stage still links home so they are never trapped
 * (note 04 §21).
 */
export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="min-h-svh lg:grid lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <AuthStage />

      <div className="flex min-h-[calc(100svh-11rem)] flex-col sm:min-h-[calc(100svh-14rem)] lg:min-h-svh">
        <main
          id="main"
          className="flex flex-1 items-start justify-center px-4 pt-10 pb-12 sm:px-8 sm:pt-14 lg:items-center lg:px-12 lg:py-16"
        >
          <div className="w-full max-w-108">{children}</div>
        </main>

        <footer className="px-4 pb-6 sm:px-8 lg:px-12">
          <nav
            aria-label="Legal"
            className="mx-auto flex max-w-108 flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground"
          >
            <Link href="/privacy" className="transition-colors hover:text-accent">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-accent">Terms</Link>
            <Link href="/contact" className="transition-colors hover:text-accent">Contact</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
