import type { Metadata } from "next";
import Link from "next/link";

import { ChoiceList } from "@/app/academy/pass/ChoiceList";
import { AccountHeader } from "@/components/account/AccountHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { membershipChoices, myMembership } from "@/lib/academy/membership";
import { academyStaffView, STAFF_MEMBERSHIP } from "@/lib/academy/staff";
import { requireUser } from "@/lib/permissions";

export const metadata: Metadata = { title: "Playlists", robots: { index: false } };

/**
 * The video playlists a Coaching Pass includes — note 07 §10.1.
 *
 * AN ACADEMY SECTION OF ITS OWN (owner, 2026-10-10). The playlists were one
 * part of the pass page, between the series and the Q&A; somebody coming to
 * watch a video had to open "Your pass" and scroll. They are a place people
 * return to, like Courses, so they have their own entry in the Academy menu.
 *
 * Which playlists are held is still the pass's rule: Silver chooses one (here),
 * Gold and Platinum hold them all. Without a pass there is nothing to watch,
 * and the page says what brings them.
 */
export default async function PlaylistsPage() {
  await requireUser("/academy/playlists");
  const [own, staffView] = await Promise.all([myMembership(), academyStaffView()]);
  // The staff view (note 06 §23.2): every playlist, as the top tier holds them.
  const staffOnly = !own && staffView;
  const membership = own ?? (staffOnly ? STAFF_MEMBERSHIP : null);

  if (!membership) {
    return (
      <>
        <AccountHeader title="Playlists" description="Tony's video library, by subject, with new videos added as they are made." />
        <EmptyState
          icon="play"
          title="Playlists come with a Coaching Pass"
          description="A Silver Pass includes one playlist of your choice; Gold and Platinum include every one."
          action={<ButtonLink href="/coaching/passes">Compare the passes</ButtonLink>}
        />
      </>
    );
  }

  const { playlists } = await membershipChoices(membership);
  const held = playlists.items.filter((p) => p.chosen);
  const open = playlists.items.filter((p) => !p.chosen);
  const choosing = playlists.allowance != null && playlists.remaining > 0 && open.length > 0;

  return (
    <>
      <AccountHeader
        title="Playlists"
        description={
          staffOnly
            ? "Every playlist. New videos appear as they are added."
            : playlists.allowance == null
              ? `Your ${membership.tierName} includes every playlist. New videos appear as they are added.`
              : `Your ${membership.tierName} includes ${playlists.allowance === 1 ? "one playlist" : `${playlists.allowance} playlists`} of your choice. New videos appear as they are added.`
        }
      />

      {held.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2">
          {held.map((p) => (
            <li key={p.id}>
              <Link
                href={`/academy/playlists/${p.slug}`}
                className="group flex h-full flex-col rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card transition-[transform,box-shadow] duration-(--dur-base) ease-expo hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transform-none"
              >
                <span className="flex items-center justify-between gap-3 text-xl font-semibold">
                  {p.name}
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent motion-reduce:transform-none"
                  >
                    &rarr;
                  </span>
                </span>
                {p.description ? (
                  <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</span>
                ) : null}
                <span className="mt-4 text-sm font-medium text-accent">Watch</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {choosing ? (
        <div className={held.length > 0 ? "mt-10" : undefined}>
          <ChoiceList items={open} remaining={playlists.remaining} held={held.length} />
        </div>
      ) : held.length === 0 ? (
        <p className="rounded-(--radius-lg) border border-dashed border-border p-5 text-sm text-muted-foreground">
          No playlists are available yet. They appear here as soon as they are published.
        </p>
      ) : null}
    </>
  );
}
