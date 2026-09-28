import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BUCKETS, isPublicBucket, type Bucket } from "@/lib/storage";
import type { Database } from "@/types/database";

type EntitlementResource =
  Database["public"]["Enums"]["entitlement_resource"];

/**
 * Signed URLs for private assets — note 05 §33, note 07, migration 0005_storage_contact_and_consent.
 *
 * PRIVATE ASSETS ARE NEVER LINKED DIRECTLY. `course-assets` and `documents`
 * have no read policy for anon or authenticated, so the only way to reach an
 * object is a short-lived signed URL minted here, and only after the
 * entitlement has been checked.
 *
 * The check uses `has_active_entitlement()` — the same function the Academy
 * pages and the RLS policies use. One authorization source, not a second one
 * beside it that can drift out of step (note 06 §2).
 *
 * The URL is minted with the service role, which does not consult storage
 * policies. That is why the absence of a read policy is a genuine backstop
 * rather than the control: if this function is ever called without its check,
 * or a session token is stolen, the object still cannot be fetched through the
 * ordinary API, and the bucket cannot be listed.
 */

/** Short by design: long enough to click, short enough not to be worth sharing. */
const DEFAULT_TTL_SECONDS = 10 * 60;

export type SignedAsset =
  | { ok: true; url: string; expiresIn: number }
  | { ok: false; reason: "unauthenticated" | "not_entitled" | "unavailable" };

/**
 * A signed URL for an asset gated behind an entitlement.
 *
 * Returns a reason rather than throwing, so a page can render "you don't have
 * access to this yet" instead of a 500 — refusal is an expected outcome here,
 * not an error.
 */
export async function signedAssetUrl(params: {
  bucket: Bucket;
  path: string;
  resourceType: EntitlementResource;
  resourceId: string;
  expiresIn?: number;
}): Promise<SignedAsset> {
  const { bucket, path, resourceType, resourceId } = params;
  const expiresIn = params.expiresIn ?? DEFAULT_TTL_SECONDS;

  if (isPublicBucket(bucket)) {
    // Signing a public object is pointless — the object is readable without a
    // token — and hides a mistake about where the file should live.
    throw new Error(`${bucket} is public — use publicAssetUrl()`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };

  // Asked as the USER, so the answer is theirs and not the service role's.
  const { data: entitled, error } = await supabase.rpc(
    "has_active_entitlement",
    { p_resource_type: resourceType, p_resource_id: resourceId },
  );

  if (error) {
    console.error("entitlement check failed", { message: error.message });
    return { ok: false, reason: "unavailable" };
  }

  if (entitled !== true) return { ok: false, reason: "not_entitled" };

  // Only now, and only with the narrow path we were asked for.
  const { data, error: signError } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrl(path, expiresIn);

  if (signError || !data?.signedUrl) {
    console.error("signing failed", {
      bucket,
      message: signError?.message ?? "no url returned",
    });
    return { ok: false, reason: "unavailable" };
  }

  return { ok: true, url: data.signedUrl, expiresIn };
}

/**
 * A signed URL for a private asset that only staff may see — an admin preview
 * of something not yet published, where there is no entitlement to check.
 */
export async function signedStaffAssetUrl(params: {
  bucket: Bucket;
  path: string;
  expiresIn?: number;
}): Promise<SignedAsset> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, reason: "unauthenticated" };

  const { data: staff, error } = await supabase.rpc("is_staff");
  if (error || staff !== true) return { ok: false, reason: "not_entitled" };

  const { data, error: signError } = await createAdminClient()
    .storage.from(params.bucket)
    .createSignedUrl(params.path, params.expiresIn ?? DEFAULT_TTL_SECONDS);

  if (signError || !data?.signedUrl) {
    return { ok: false, reason: "unavailable" };
  }

  return {
    ok: true,
    url: data.signedUrl,
    expiresIn: params.expiresIn ?? DEFAULT_TTL_SECONDS,
  };
}

export { BUCKETS };
