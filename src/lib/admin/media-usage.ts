import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Where a Media item is used (owner, 2026-10-15).
 *
 * Deleting a Media item deletes its file too, and a deleted file cannot be got
 * back. Most columns pointing at `resources` are `on delete set null`, so the
 * database would let the delete through and the page would simply lose its
 * image. A Media item still in use is therefore refused, naming where.
 *
 * Every foreign key to `resources` is listed here. A database test counts
 * them (supabase/tests/schema_test.sql), so a new one fails the test until it
 * is added to this list.
 */
type Use = {
  table: string;
  column: string;
  /** How the use reads: "the cover of", "a photo in", … */
  role: string;
  /** The column naming the row, or the parent row for a gallery entry. */
  label: string;
  via?: { table: string; key: string };
};

const USES: readonly Use[] = [
  { table: "courses", column: "cover_resource_id", role: "the cover of the course", label: "title" },
  { table: "group_coaching_series", column: "cover_resource_id", role: "the cover of the series", label: "name" },
  { table: "group_coaching_sessions", column: "recording_resource_id", role: "the recording of the session", label: "title" },
  { table: "cohorts", column: "cover_resource_id", role: "the cover of the cohort", label: "name" },
  { table: "cohort_workshops", column: "recording_resource_id", role: "the recording of the workshop", label: "title" },
  { table: "retreats", column: "cover_resource_id", role: "the cover of the retreat", label: "name" },
  { table: "events", column: "cover_resource_id", role: "the cover of the event", label: "name" },
  { table: "private_coaching_services", column: "cover_resource_id", role: "the cover of the service", label: "name" },
  { table: "blog_posts", column: "cover_resource_id", role: "the cover of the post", label: "title" },
  { table: "catalogue_items", column: "cover_resource_id", role: "the cover of", label: "title" },
  { table: "catalogue_item_resources", column: "resource_id", role: "attached to", label: "title",
    via: { table: "catalogue_items", key: "catalogue_item_id" } },
  { table: "team_members", column: "photo_resource_id", role: "the photo of", label: "name" },
  { table: "testimonial_videos", column: "cover_resource_id", role: "the cover of the video testimonial", label: "title" },
  { table: "event_images", column: "resource_id", role: "a photo of the event", label: "name",
    via: { table: "events", key: "event_id" } },
  { table: "playlists", column: "cover_resource_id", role: "the cover of the playlist", label: "name" },
  { table: "member_qa_sessions", column: "recording_resource_id", role: "the recording of the Q&A", label: "title" },
];

/** Each place the item is used, as a phrase: `the cover of "The Walk"`. */
export async function mediaUsage(resourceId: string): Promise<string[]> {
  const admin = createAdminClient();

  const found = await Promise.all(
    USES.map(async (use) => {
      const select = use.via ? `${use.via.table}(${use.label})` : use.label;
      const { data, error } = await admin
        .from(use.table as "courses")
        .select(select)
        .eq(use.column, resourceId)
        .limit(5);
      // Unreadable is treated as in use: refusing a delete is recoverable,
      // deleting a file that was needed is not.
      if (error) return [`${use.role} (could not be checked)`];

      return ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => {
        const source = use.via ? (row[use.via.table] as Record<string, unknown> | null) : row;
        const name = source?.[use.label];
        return name ? `${use.role} "${String(name)}"` : use.role;
      });
    }),
  );

  return found.flat();
}
