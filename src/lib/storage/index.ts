import { publicEnv } from "@/lib/env/public";

/**
 * Storage buckets — migration 0019, note 02 §37, note 08 §26.
 *
 * Buckets are split by WHO MAY READ, not by file type: `public` is a per-bucket
 * flag, so which bucket a file is in decides its access rule. That is also the
 * one property that cannot be changed later without moving every object and
 * rewriting every stored path.
 */
export const BUCKETS = {
  /** Profile photos. Public. Path MUST begin with the owner's user id. */
  avatars: "avatars",
  /** All marketing imagery, including course thumbnails. Public. */
  siteMedia: "site-media",
  /** Material attached to Academy content. Private, entitlement-gated. */
  courseAssets: "course-assets",
  /** Standalone gated documents, not tied to a course. Private. */
  documents: "documents",
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

const PUBLIC_BUCKETS: readonly Bucket[] = [BUCKETS.avatars, BUCKETS.siteMedia];

export function isPublicBucket(bucket: Bucket): boolean {
  return PUBLIC_BUCKETS.includes(bucket);
}

/**
 * The URL for an object in a PUBLIC bucket.
 *
 * Built here rather than stored, because a stored URL carries the project host
 * and would be wrong the moment local, preview and production differ. The
 * database holds the PATH; the host comes from the environment (note 08 §26).
 *
 * Safe in a Client Component: it only concatenates public values.
 */
export function publicAssetUrl(bucket: Bucket, path: string): string {
  if (!isPublicBucket(bucket)) {
    // A private object has no public URL. Returning one would produce a link
    // that fails in production and looks like a broken image rather than a
    // permissions mistake.
    throw new Error(
      `${bucket} is a private bucket — use signedAssetUrl() after checking entitlement`,
    );
  }

  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/**
 * Build an object path from an entity id.
 *
 * IDS, NOT SLUGS. Storage has no rename: a slug edited for SEO would strand
 * every object beneath it, and repairing that means copy-then-delete on each
 * one. Ids never change. The slug belongs in the URL, not the storage key.
 */
export function assetPath(
  entity: string,
  entityId: string,
  filename: string,
): string {
  return `${entity}/${entityId}/${filename}`;
}
