import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { myProfile } from "@/lib/account";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };

/**
 * Settings — note 03 §24.
 *
 * This was an empty placeholder saying preferences would "arrive alongside
 * notifications". Every setting a customer actually has already exists — it is
 * just spread across Profile, Security and Notifications — so the honest job
 * for this page is to be the MAP of them, plus the one thing that has nowhere
 * else to live: ending the account.
 *
 * ACCOUNT DELETION IS PRESENTED, NOT PERFORMED. Note 05 §24 and §25 make
 * deletion a controlled lifecycle operation: financial records must be retained
 * even when personal data is removed, so it cannot be a button that cascades
 * through the schema. Until that flow is built, offering a self-service delete
 * would either lie about what it does or destroy records that must be kept.
 * The page says plainly how to request it and what happens.
 */
const AREAS = [
  {
    href: "/account/profile",
    title: "Profile",
    description: "Your name, display name and avatar.",
  },
  {
    href: "/account/security",
    title: "Security",
    description: "Password and two-factor keys.",
  },
  {
    href: "/account/notifications",
    title: "Notifications",
    description: "Which emails you receive, and opting out of marketing.",
  },
  {
    href: "/account/entitlements",
    title: "Your access",
    description: "What you can use, how long it lasts and when it renews.",
  },
];

export default async function SettingsPage() {
  await requireUser("/account/settings");
  const profile = await myProfile();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Everything about your account, and where to change it."
      />

      <ul className="grid gap-4 sm:grid-cols-2">
        {AREAS.map((area) => (
          <li key={area.href}>
            <Link
              href={area.href}
              className="group flex h-full flex-col rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow,border-color] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift motion-reduce:transform-none motion-reduce:transition-none"
            >
              <p className="font-display text-base font-semibold group-hover:text-primary">
                {area.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {area.description}
              </p>
              <span
                aria-hidden="true"
                className="mt-3 text-sm text-primary transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
              >
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="closing"
        className="mt-10 rounded-(--radius-lg) border border-error/40 bg-error/5 p-5"
      >
        <h2 id="closing" className="font-display text-base font-semibold">
          Closing your account
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Email us from{" "}
          <span className="font-medium text-foreground">
            {profile?.display_name ? "your registered address" : "your account address"}
          </span>{" "}
          and we will close it. Your personal details are removed, and any
          courses or memberships you hold end at that point.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Records of what you paid are kept — we are legally required to hold
          them — but they are separated from your personal information.
        </p>
        <p className="mt-4">
          <Link
            href="/contact?subject=Close%20my%20account"
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Request account closure &rarr;
          </Link>
        </p>
      </section>
    </>
  );
}
