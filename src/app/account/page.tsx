import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/Reveal";
import { PageHeader } from "@/components/layout/PageHeader";
import { myEntitlements, myOrders, mySubscriptions } from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function AccountPage() {
  const context = await requireUser("/account");
  const [orders, entitlements, subscriptions] = await Promise.all([
    myOrders(),
    myEntitlements(),
    mySubscriptions(),
  ]);

  const active = entitlements.filter((e) => e.status === "active").length;
  const membership = subscriptions.find((s) => s.status === "active");

  return (
    <>
      <PageHeader title="Your account" description={context.email ?? undefined} />

      <dl className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["Active access", String(active), "/account/entitlements"],
            ["Orders", String(orders.length), "/account/orders"],
            ["Membership", membership?.membership_tier ?? "None", "/account/memberships"],
          ] as const
        ).map(([label, value, href], index) => (
          <Reveal as="div" key={label} delay={index * 60}>
            <Link
              href={href}
              className="block rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
            >
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold capitalize">{value}</dd>
            </Link>
          </Reveal>
        ))}
      </dl>

      {context.isStaff ? (
        <div className="mt-8 rounded-(--radius-lg) border border-border bg-surface p-5">
          <p className="text-sm">
            This account holds a staff role.{" "}
            <Link href="/admin" className="font-medium text-primary underline-offset-4 hover:underline">
              Go to the admin workspace
            </Link>
            .
          </p>
        </div>
      ) : null}
    </>
  );
}
