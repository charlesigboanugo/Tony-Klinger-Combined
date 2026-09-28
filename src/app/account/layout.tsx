import { headers } from "next/headers";

import { AccountNav } from "@/components/account/AccountNav";
import { Container } from "@/components/layout/Container";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";
import { requireSession, requireUser } from "@/lib/permissions";

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
 * viewport, scrolling on its own if its items outgrow it (note 04 §32.2). Below lg the navigation collapses to
 * one section button above the page (AccountNav).
 */
export default async function AccountLayout({
  children,
}: LayoutProps<"/account">) {
  /*
    ONE PATH IS EXEMPT from the second-factor gate: the key management page.

    A staff account with no keys is sent there to enrol, and enrolling is the
    only way it can ever reach `aal2` — gating it would be a closed loop with no
    door. Everything else under /account asks for the factor, so a customer who
    registered a key is challenged rather than quietly let past it.

    The path comes from the proxy's own header (note 04 §32.1); a layout cannot
    otherwise see which page it is rendering.
  */
  const pathname = (await headers()).get("x-pathname") ?? "";
  const enrolling = pathname.startsWith("/account/security/mfa");

  const context = enrolling
    ? await requireSession("/account/security/mfa")
    : await requireUser("/account");


  return (
    <div className="flex min-h-svh flex-col">
      <WorkspaceHeader
        label="Account"
        home="/account"
        strip="bg-block-oxblood"
        email={context.email ?? ""}
        links={context.isStaff ? [{ href: "/admin", label: "Admin" }] : []}
      />

      <Container className="flex-1">
        <div className="flex flex-col gap-6 pt-6 pb-20 sm:pt-8 lg:flex-row lg:items-start lg:gap-12 lg:pt-0 lg:pb-0">
          <aside className="z-30 lg:sticky lg:top-16.25 lg:h-[calc(100svh-4.0625rem)] lg:w-52 lg:shrink-0 lg:overflow-y-auto">
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
