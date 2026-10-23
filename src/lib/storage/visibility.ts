import "server-only";

import { BUCKETS } from "@/lib/storage";
import { bucketFor, isUploadKind } from "@/lib/storage/upload-kinds";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Making a Media file public or private (owner, 2026-10-15).
 *
 * Who can open a file is decided by its BUCKET (note 08 §26), so changing it
 * means moving the file: `site-media` (public) ↔ `private-media` (private),
 * same key, and the stored path follows. Done when the Media form is saved
 * with "Anyone can open it" changed, so staff flip one switch instead of
 * uploading the file again.
 *
 * Only audio and documents move: an image is always public, and a file in any
 * other bucket (course material, profile photos) is not Media's to move.
 */
const MOVABLE = [BUCKETS.siteMedia, BUCKETS.privateMedia] as const;

export type Placed =
  | { ok: true; path: string; moved?: { from: string; to: string } }
  | { ok: false; error: string };

export async function placeMediaFile({
  path,
  kind,
  visibility,
  rowId,
}: {
  /** The stored path, `bucket/key`. */
  path: string;
  /** The item's type. */
  kind: string;
  /** What the form asked for; anything else leaves the file where it is. */
  visibility: string | undefined;
  /** The item being saved, when it exists already. */
  rowId?: string;
}): Promise<Placed> {
  if ((visibility !== "public" && visibility !== "private") || !isUploadKind(kind) || kind === "image") {
    return { ok: true, path };
  }
  const slash = path.indexOf("/");
  const bucket = path.slice(0, slash);
  const key = path.slice(slash + 1);
  if (slash < 1 || !(MOVABLE as readonly string[]).includes(bucket)) return { ok: true, path };

  const target = bucketFor(kind, visibility);
  if (target === bucket) return { ok: true, path };

  const admin = createAdminClient();
  // Another item naming the same file would be left pointing at nothing.
  let others = admin.from("resources").select("id", { count: "exact", head: true }).eq("storage_path", path);
  if (rowId) others = others.neq("id", rowId);
  const { count } = await others;
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Another media item uses this same file, so it cannot be made ${visibility} here. Upload the file again instead.`,
    };
  }

  const { error } = await admin.storage.from(bucket).move(key, key, { destinationBucket: target });
  if (error) return { ok: false, error: `The file could not be made ${visibility}: ${error.message}` };
  const moved = `${target}/${key}`;
  return { ok: true, path: moved, moved: { from: path, to: moved } };
}

/** Put a moved file back, when the save it was part of did not hold. */
export async function undoPlaceMediaFile(moved: { from: string; to: string } | undefined): Promise<void> {
  if (!moved) return;
  const [toBucket, ...toKey] = moved.to.split("/");
  const fromBucket = moved.from.split("/")[0];
  const key = toKey.join("/");
  const { error } = await createAdminClient().storage.from(toBucket).move(key, key, { destinationBucket: fromBucket });
  if (error) console.error("media file move-back failed", { ...moved, message: error.message });
}
