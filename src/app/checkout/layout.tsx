import Link from "next/link";

/** Checkout — minimal, task-focused layout (note 04 §18, note 03 §31). */
export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            Tony Klinger
          </Link>
          <span className="text-sm text-muted-foreground">Secure checkout</span>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-3xl gap-4 px-4 py-6 text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link href="/contact" className="hover:text-foreground">Need help?</Link>
        </div>
      </footer>
    </div>
  );
}
