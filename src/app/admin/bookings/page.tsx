import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { requirePermission } from "@/lib/permissions";

export const metadata: Metadata = { title: "Bookings · Admin", robots: { index: false } };

/**
 * The permission gate is real and enforced server-side — an operator without
 * `bookings.read` never reaches this page, and the sidebar hides it (note 06 §24).
 *
 * The management interface itself is not built yet.
 */
export default async function Page() {
  await requirePermission("bookings.read", "/admin/bookings");

  return (
    <>
      <PageHeader title="Bookings" description="All customer bookings." />
      <EmptyState
        title="Not built yet"
        description="This area is reachable and permission-checked, but its management interface is still to come."
      />
    </>
  );
}
