import { publicEnv } from "@/lib/env/public";

/**
 * Public URL for a stored object — note 02 §37.
 *
 * `resources.storage_path` holds a BUCKET-RELATIVE key, never a full URL. The
 * Supabase host differs between local (127.0.0.1:54321) and production, so a
 * stored URL would be correct in exactly one environment and silently wrong in
 * the other. The host is derived here, at render time, from the same variable
 * `next.config.ts` allowlists for next/image.
 *
 * Public buckets only. A private object needs a signed URL minted server-side
 * after an entitlement check — see src/lib/storage/signed.ts.
 */
export function publicStorageUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;

  // Tolerate a leading slash or an accidental full URL rather than producing a
  // broken src: content is edited by hand in /admin.
  const key = storagePath.replace(/^\/+/, "");
  if (/^https?:\/\//i.test(key)) return key;

  const base = publicEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${key}`;
}
