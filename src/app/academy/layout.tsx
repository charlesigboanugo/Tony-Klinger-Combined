import Link from "next/link";

import { signOutAction } from "@/app/auth/actions";
import { AcademyNav } from "@/components/academy/AcademyNav";
import { Container } from "@/components/layout/Container";
import { getAuthContext } from "@/lib/permissions";

/**
 * Academy layout — note 04 §10, §30.
 *
 * `/academy` itself is public: a guest sees a landing page explaining the
 * Academy with a sign-in entry point (R14, note 03 §18). Everything beneath it
 * requires a session, enforced by the proxy and again by each page.
 *
 * So this layout renders the workspace chrome only when signed in. A guest gets
 * a bare wrapper and the landing page inside it — showing an authenticated
 * shell around a sign-in prompt would be nonsense.
 */
export default async function AcademyLayout({
  children,
}: LayoutProps<"/academy">) {
  const context = await getAuthContext();

  if (!context) {
    return <div className="flex min-h-svh flex-col">{children}</div>;
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/*
        A thin colour strip identifies the workspace. Note 04 §10 asks the
        Academy to feel like a distinct place while remaining one platform;
        borrowing a jewel field for 3px does that without a second palette.
      */}
      <div aria-hidden="true" className="h-[3px] w-full bg-block-teal" />
      {/* Sticky, matching the Admin header (note 04 §16, `AdminLayout`) — the
          sidebar below sticks to a `top` offset measured from this header's
          height, which only stays correct if the header itself never scrolls
          out of view. The 3px strip above is NOT sticky, same as Admin's: it
          scrolls away first and the header then sits flush at the true top. */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <Container>
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/" className="font-semibold tracking-tight">
                Tony Klinger
              </Link>
              <span className="rounded-full bg-block-teal px-2.5 py-0.5 text-[0.6875rem] font-semibold tracking-[0.1em] text-block-foreground uppercase">
                Academy
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/account"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Account
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-(--radius) border border-border px-3 py-1.5 text-sm"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </Container>
      </header>

      <Container>
        {/*
          Sidebar and content scroll INDEPENDENTLY, same as the Admin layout
          (note 04 §16) — not a static border pretending to be a separation.
          `lg:sticky` plus its own `overflow-y-auto` and a height capped to the
          viewport means the nav pins under the header and scrolls on its own
          only if it ever grows taller than the viewport; the page underneath
          scrolls normally. Whichever column is actually longer is the one
          that moves — the short nav list here just stays put while a long
          lesson page scrolls past it, which reads as "separate panes" far
          more clearly than a drawn line ever did.
        */}
        <div className="flex flex-col gap-8 py-8 lg:flex-row lg:items-start">
          <aside className="lg:sticky lg:top-16.75 lg:h-[calc(100svh-4rem-3px)] lg:w-52 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain">
            <AcademyNav />
          </aside>
          <main id="main" className="min-w-0 flex-1">{children}</main>
        </div>
      </Container>
    </div>
  );
}
