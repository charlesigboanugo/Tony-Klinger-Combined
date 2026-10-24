
import { AccountNav } from "@/components/account/AccountNav";
import { Container } from "@/components/layout/Container";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";
import { SessionSync } from "@/components/navigation/SessionSync";
import { requireSession } from "@/lib/permissions";

/**
 * Account layout — note 04 §13, §31.
 *
 * A focused workspace, like the Academy: the shared `WorkspaceHeader` (the
 * site mark, "Account", a way back to the site and the account menu) with no
 * main site menu, then the sidebar and the page. The public masthead was
 * tried here on 2026-09-26 and withdrawn the same day at the owner's
 * direction. Oxblood is Account's identity colour, on the strip.
 *
 * The sidebar sticks flush under the header and runs to the bottom of the
 * viewport, scrolling on its own if its items outgrow it (note 04 §32.2). Below lg there is no
 * sidebar: the header's hamburger opens the same list from the left (§32.4).
 */
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  /*
    THE LAYOUT ONLY ASKS FOR A SESSION; each page asks for the second factor
    (`requireUser`), and the key page itself does not (2026-10-24).

    It used to redirect key-less staff from here, exempting the key page by
    path. A redirect thrown by this layout to a page under this same layout,
    during an in-browser navigation (the account menu's Orders, say), sent the
    router into a loop: the key page was fetched without end and the screen
    stayed blank. Redirects thrown by a page, or by another layout, do not do
    this, so the gate now lives in the pages, where every one already had it.
  */
  const context = await requireSession("/account");


  return (
    <div className="flex min-h-svh flex-col">
      <SessionSync email={context.email} verified={context.hasSecondFactor} />
      <WorkspaceHeader
        label="Account"
        home="/account"
        strip="bg-block-oxblood"
        email={context.email ?? ""}
        admin={context.isStaff}
        menu={<AccountNav variant="drawer" />}
      />

      <Container className="flex-1">
        <div className="flex flex-col gap-6 pt-6 pb-20 sm:pt-8 lg:flex-row lg:items-start lg:gap-12 lg:pt-0 lg:pb-0">
          <aside className="z-30 hidden lg:sticky lg:block lg:top-16.25 lg:h-[calc(100svh-4.0625rem)] lg:w-52 lg:shrink-0 lg:overflow-y-auto">
            <div className="lg:pt-10 lg:pb-10">
              <AccountNav />
            </div>
          </aside>
          <main id="main" className="workspace min-w-0 flex-1 lg:pt-10 lg:pb-20">
            {children}
          </main>
        </div>
      </Container>
    </div>
  );
}
