import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Removing Media files from storage (owner, 2026-10-15).
 *
 * A file belongs to its Media item: deleting the item, or replacing its file,
 * removes the file. Files uploaded through the Media form go under `uploads/`,
 * and one that never became a Media item (the form was cancelled or the tab
 * closed) is swept by `cleanupAbandonedUploads` a day later.
 *
 * Only `resources.storage_path` points at these buckets' files, so a file no
 * Media item names is used by nothing. Profile photos (`avatars`) are not
 * Media and are never touched here.
 */
const MEDIA_BUCKETS = ["site-media", "private-media", "course-assets"] as const;

/** Media-form uploads live under this folder in each bucket. */
export const UPLOADS_FOLDER = "uploads";

/** How long an upload may sit unsaved before the cleanup removes it. */
const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

function split(storagePath: string): { bucket: string; key: string } | null {
  const path = storagePath.replace(/^\/+/, "");
  const slash = path.indexOf("/");
  if (slash < 1) return null;
  const bucket = path.slice(0, slash);
  if (!(MEDIA_BUCKETS as readonly string[]).includes(bucket)) return null;
  return { bucket, key: path.slice(slash + 1) };
}

/**
 * Delete a Media file, unless another Media item still names it.
 *
 * Never throws: the record change it follows has already been made, and a
 * file left behind is a tidiness problem, not a broken page. Logged instead.
 */
export async function removeMediaFile(storagePath: string | null | undefined): Promise<void> {
  if (!storagePath) return;
  const target = split(storagePath);
  if (!target) return;

  const admin = createAdminClient();
  const { count, error: countError } = await admin
    .from("resources")
    .select("id", { count: "exact", head: true })
    .eq("storage_path", storagePath);
  if (countError || (count ?? 0) > 0) return;

  const { error } = await admin.storage.from(target.bucket).remove([target.key]);
  if (error) {
    console.error("media file removal failed", { storagePath, message: error.message });
  }
}

/**
 * Delete uploads that never became a Media item — the scheduled cleanup.
 *
 * Only `uploads/` is looked at, so files imported before launch are out of
 * reach whatever their state. Older than a day, so someone who leaves the
 * form open and comes back can still save. Idempotent: a missed or doubled
 * run just finds the same files, or none.
 */
export async function cleanupAbandonedUploads(): Promise<{ removed: number; errors: string[] }> {
  const admin = createAdminClient();
  const cutoff = Date.now() - ABANDONED_AFTER_MS;
  let removed = 0;
  const errors: string[] = [];

  for (const bucket of ["site-media", "private-media"] as const) {
    const stale: string[] = [];

    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.storage
        .from(bucket)
        .list(UPLOADS_FOLDER, { limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } });
      if (error) {
        errors.push(`${bucket}: ${error.message}`);
        break;
      }
      for (const file of data ?? []) {
        // A folder entry has no id; only files are considered.
        if (!file.id || !file.created_at) continue;
        if (new Date(file.created_at).getTime() < cutoff) stale.push(`${bucket}/${UPLOADS_FOLDER}/${file.name}`);
      }
      if (!data || data.length < 1000) break;
    }

    // Which of them a Media item names, in batches small enough for a URL.
    for (let i = 0; i < stale.length; i += 100) {
      const batch = stale.slice(i, i + 100);
      const { data: used, error } = await admin.from("resources").select("storage_path").in("storage_path", batch);
      if (error) {
        errors.push(`${bucket}: ${error.message}`);
        continue;
      }
      const kept = new Set((used ?? []).map((r) => r.storage_path));
      const orphans = batch.filter((path) => !kept.has(path)).map((path) => path.slice(bucket.length + 1));
      if (orphans.length === 0) continue;

      const { error: removeError } = await admin.storage.from(bucket).remove(orphans);
      if (removeError) errors.push(`${bucket}: ${removeError.message}`);
      else removed += orphans.length;
    }
  }

  return { removed, errors };
}
