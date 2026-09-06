import Link from "next/link";

/**
 * Auth layout — minimal, task-focused (note 04 §17, note 03 §31).
 *
 * The full public menu is deliberately absent: the user is completing one task.
 * The brand still links home so they are never trapped (note 04 §21).
 */
export default function AuthLayout({ children }: LayoutProps<"/auth">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Tony Klinger
          </Link>
        </div>
      </header>

      <main id="main" className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl gap-4 px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/contact" className="hover:text-foreground">Contact</Link>
        </div>
      </footer>
    </div>
  );
}
