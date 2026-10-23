import { Container } from "@/components/layout/Container";
import { TaskFooter } from "@/components/navigation/TaskFooter";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";
import { SessionSync } from "@/components/navigation/SessionSync";
import { requireUser } from "@/lib/permissions";

/**
 * Booking — task-focused layout (note 04 §20, §33; note 03 §31).
 *
 * NO main site menu. Booking is one task (service → time → confirm), and the
 * public masthead would put the whole site one click away from abandoning it.
 * It does get the shared `WorkspaceHeader`, as Account and the Academy do, so
 * the brand and the account menu (with "Back to site" and Bookings in it) are
 * always there: nobody is trapped (note 04 §21). Every booking page is signed-in only,
 * so the account menu always has an address to show.
 *
 * Oxblood strip: booking is an Account task — what it produces is managed
 * under /account/bookings. Pages use the `.workspace` app type scale, not the
 * public display headings.
 */
export default async function BookingsLayout({ children }: LayoutProps<"/book">) {
  const context = await requireUser("/book");

  return (
    <div className="flex min-h-svh flex-col">
      <SessionSync email={context.email} />
      <WorkspaceHeader
        label="Book"
        home="/book"
        strip="bg-block-oxblood"
        email={context.email ?? ""}
        admin={context.isStaff}
      />
      <main id="main" className="workspace flex-1 pt-8 pb-20 sm:pt-10">
        <Container width="narrow">{children}</Container>
      </main>
      <TaskFooter />
    </div>
  );
}
