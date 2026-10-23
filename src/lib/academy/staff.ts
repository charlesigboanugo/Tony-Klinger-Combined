import "server-only";

import { cache } from "react";

import type { EnrolledCohort, EnrolledCourse } from "@/lib/academy";
import type { Membership } from "@/lib/academy/membership";
import { can, getAuthContext } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * The Academy's staff view — note 06 §23.2, migration 0018.
 *
 * Staff holding `academy.view_all` see everything the Academy delivers without
 * buying it. Seeing is all it gives: booking, registering, choosing, recording
 * progress and joining a live session still need a real purchase, which the
 * database checks regardless of what a page shows. Pages use this to list
 * everything, and to swap those actions for a "Staff view" note.
 *
 * Where a staff member has also bought something, the action for THAT thing
 * stays theirs: pages decide per item with `viewOnly(staff, entitled)`.
 */
export const academyStaffView = cache(async (): Promise<boolean> => {
  const context = await getAuthContext();
  return Boolean(context && can(context, "academy.view_all"));
});

/** True where the caller sees an item only because of the staff view. */
export function viewOnly(staffView: boolean, entitled: boolean): boolean {
  return staffView && !entitled;
}

/**
 * What a pass page shows in the staff view: the top of every tier, with no
 * allowance to spend and nothing to renew.
 */
export const STAFF_MEMBERSHIP: Membership = {
  tier: "staff",
  tierName: "Coaching Pass",
  rank: Number.MAX_SAFE_INTEGER,
  expiresAt: null,
  renews: false,
  date: null,
  pastDue: false,
  seriesAllowance: null,
  playlistAllowance: null,
  includesQa: true,
  includesRetreats: true,
  yearly: true,
};

/** Every published course, shaped like the caller's own list. */
export async function allCourses(): Promise<EnrolledCourse[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("id,title,slug,description,resources!cover_resource_id(storage_path)")
    .eq("status", "published")
    .order("title");

  return ((data ?? []) as unknown as Array<{
    id: string;
    title: string;
    slug: string;
    description: string | null;
    resources: { storage_path: string } | null;
  }>).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    expiresAt: null,
    storagePath: c.resources?.storage_path ?? null,
  }));
}

/**
 * Every published cohort, dated by its intake under way or else the next —
 * the same rule a member with standing access sees (`myCohorts`).
 */
export async function allCohorts(): Promise<EnrolledCohort[]> {
  const supabase = await createClient();
  const now = Date.now();

  const [{ data: cohorts }, { data: intakes }] = await Promise.all([
    supabase
      .from("cohorts")
      .select("id,name,slug,description,cohort_level,resources!cover_resource_id(storage_path)")
      .eq("status", "published")
      .order("name"),
    supabase
      .from("cohort_intakes")
      .select("cohort_id,label,starts_at,ends_at")
      .eq("status", "published")
      .gt("ends_at", new Date(now).toISOString())
      .order("starts_at"),
  ]);

  const intakeByCohort = new Map<string, { label: string; starts_at: string; ends_at: string }>();
  for (const intake of (intakes ?? []) as Array<{ cohort_id: string; label: string; starts_at: string; ends_at: string }>) {
    // Soonest first, so the first seen for a cohort is the one running or next.
    if (!intakeByCohort.has(intake.cohort_id)) intakeByCohort.set(intake.cohort_id, intake);
  }

  return ((cohorts ?? []) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    cohort_level: string;
    resources: { storage_path: string } | null;
  }>).map((c) => {
    const intake = intakeByCohort.get(c.id);
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      cohortLevel: c.cohort_level,
      startsAt: intake?.starts_at ?? null,
      endsAt: intake?.ends_at ?? null,
      inProgress: Boolean(intake && +new Date(intake.starts_at) <= now && +new Date(intake.ends_at) > now),
      intakeLabel: intake?.label ?? null,
      storagePath: c.resources?.storage_path ?? null,
    };
  });
}

export type StaffRetreat = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  notes: string | null;
};

/** Every retreat batch still to finish, with no joining link. */
export async function allRetreats(): Promise<StaffRetreat[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("retreat_batches")
    .select("id,label,starts_at,ends_at,joining_notes,retreats(name,status)")
    .eq("status", "published")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at");

  return ((data ?? []) as unknown as Array<{
    id: string;
    label: string;
    starts_at: string;
    ends_at: string;
    joining_notes: string | null;
    retreats: { name: string; status: string } | null;
  }>)
    .filter((b) => b.retreats?.status === "published")
    .map((b) => ({
      id: b.id,
      name: `${b.retreats!.name} · ${b.label}`,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      notes: b.joining_notes,
    }));
}
