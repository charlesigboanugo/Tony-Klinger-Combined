import { AcademyNav } from "@/components/academy/AcademyNav";
import { Container } from "@/components/layout/Container";
import { PublicFooter } from "@/components/navigation/PublicFooter";
import { PublicHeader } from "@/components/navigation/PublicHeader";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";
import { getAuthContext } from "@/lib/permissions";

/**
 * Academy layout — note 04 §9, §10, §30.
 *
 * `/academy` itself is public: a guest sees a landing page explaining the
 * Academy with a sign-in entry point (R14, note 03 §18). Everything beneath it
 * requires a session, enforced by the proxy and again by each page.
 *
 * A GUEST GETS THE PUBLIC LAYOUT — masthead and footer — as note 04 §9 says.
 * It used to get a bare wrapper, so the landing page had no way back to the
 * rest of the site but the browser's back button. Showing the authenticated
 * workspace around a sign-in prompt would be nonsense; showing nothing at all
 * was a dead end.
 *
 * Signed in, it is the focused workspace (note 04 §10): its own header with
 * the Academy mark, a way back to the site, and the account menu the public
 * masthead uses — then the sidebar and the page.
 */
export default async function AcademyLayout({
  children,
}: LayoutProps<"/academy">) {
  const context = await getAuthContext();

  if (!context) {
    return (
      <>
        <PublicHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <PublicFooter />
      </>
    );
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* Identity strip in noir, then the shared workspace header (note 04 §10). */}
      <WorkspaceHeader
        label="Academy"
        home="/academy"
        strip="bg-block-noir"
        email={context.email ?? ""}
      />

      <Container className="flex-1">
        {/*
          Sidebar and content scroll INDEPENDENTLY, same as the Admin layout
          (note 04 §16) — not a static border pretending to be a separation.
          `lg:sticky` plus its own overflow and a height of exactly the
          viewport below the 65px header, so the pane runs flush from the
          header to the bottom of the screen; the page underneath scrolls
          normally. `overflow-y-scroll`, not `-auto`: the short Academy menu
          never overflows, and the owner wants the scroll track drawn anyway as
          the menu/content separation Account gets from its longer menu.
        */}
        <div className="flex flex-col gap-6 pt-6 pb-20 sm:pt-8 lg:flex-row lg:items-start lg:gap-12 lg:pt-0 lg:pb-0">
          <aside className="z-30 lg:sticky lg:top-16.25 lg:h-[calc(100svh-4.0625rem)] lg:w-52 lg:shrink-0 lg:overflow-y-scroll">
            <div className="lg:pt-10 lg:pb-10">
              <AcademyNav />
            </div>
          </aside>
          <main id="main" className="workspace min-w-0 flex-1 lg:pt-10 lg:pb-20">{children}</main>
        </div>
      </Container>
    </div>
  );
}
