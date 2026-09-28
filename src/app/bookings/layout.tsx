import { Container } from "@/components/layout/Container";
import { TaskFooter } from "@/components/navigation/TaskFooter";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";
import { requireUser } from "@/lib/permissions";

/**
 * Booking — task-focused layout (note 04 §20, §33; note 03 §31).
 *
 * NO main site menu. Booking is one task (service → time → confirm), and the
 * public masthead would put the whole site one click away from abandoning it.
 * It does get the shared `WorkspaceHeader`, as Account and the Academy do, so
 * the brand, "Back to site", "Your bookings" and the account menu are always
 * there: nobody is trapped (note 04 §21). Every booking page is signed-in only,
 * so the account menu always has an address to show.
 *
 * Oxblood strip: booking is an Account task — what it produces is managed
 * under /account/bookings. Pages use the `.workspace` app type scale, not the
 * public display headings.
 */
export default async function BookingsLayout({ children }: LayoutProps<"/bookings">) {
  const context = await requireUser("/bookings");

  return (
    <div className="flex min-h-svh flex-col">
      <WorkspaceHeader
        label="Booking"
        home="/bookings"
        strip="bg-block-oxblood"
        email={context.email ?? ""}
        links={[{ href: "/account/bookings", label: "Your bookings" }]}
      />
      <main id="main" className="workspace flex-1 pt-8 pb-20 sm:pt-10">
        <Container width="narrow">{children}</Container>
      </main>
      <TaskFooter />
    </div>
  );
}
