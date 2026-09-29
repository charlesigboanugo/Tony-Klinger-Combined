import "server-only";

import { createPublicClient } from "@/lib/supabase/public";

/** A team member with their photo's storage path resolved. */
export type TeamMember = {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  bio: string | null;
  storage_path: string | null;
};

/**
 * Published team members, in their curated order.
 *
 * The photo is joined rather than fetched per member: five sequential lookups
 * on a page that always renders all five is five round trips for one answer.
 */
export async function listTeam(): Promise<TeamMember[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("team_members")
    .select("id,name,slug,role,bio,resources(storage_path)")
    .eq("status", "published")
    .order("position", { ascending: true });

  type Embedded = { storage_path?: string | null };
  type Row = Omit<TeamMember, "storage_path"> & {
    resources?: Embedded | Embedded[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => {
    const joined = Array.isArray(row.resources) ? row.resources[0] : row.resources;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      role: row.role,
      bio: row.bio,
      storage_path: joined?.storage_path ?? null,
    };
  });
}
