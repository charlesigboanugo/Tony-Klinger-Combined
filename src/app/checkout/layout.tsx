import { Container } from "@/components/layout/Container";
import { TaskFooter } from "@/components/navigation/TaskFooter";
import { WorkspaceHeader } from "@/components/navigation/WorkspaceHeader";

/**
 * Checkout — minimal, task-focused layout (note 04 §18, §33; note 03 §31).
 *
 * No main site menu while somebody is paying. The shared `WorkspaceHeader`
 * without an account menu (guests check out too) carries the brand and a
 * visible "Back to site" at every width; the page itself offers "Back to your
 * cart". Noir strip — checkout belongs to no workspace, and noir is the
 * site's only colour field (note 10 §5).
 */
export default function CheckoutLayout({ children }: LayoutProps<"/checkout">) {
  return (
    <div className="flex min-h-svh flex-col">
      <WorkspaceHeader label="Checkout" home="/checkout" strip="bg-block-noir" />
      <main id="main" className="flex-1 pt-8 pb-20 sm:pt-10">
        <Container width="narrow">{children}</Container>
      </main>
      <TaskFooter />
    </div>
  );
}
