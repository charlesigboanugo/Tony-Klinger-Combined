import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv } from "@/lib/env/public";
import { requireServerEnv } from "@/lib/env/server";

/**
 * Service-role Supabase client. **Bypasses Row Level Security entirely.**
 *
 * Per note 08 §61 and note 06 §29, use this only where elevated access is
 * genuinely required — webhook processing that must write on behalf of a user
 * who is not the caller, and scheduled maintenance jobs.
 *
 * Do not reach for it because writing an RLS policy is inconvenient. Every use
 * is a place where the database will not catch a mistake, so the calling code
 * carries the whole burden of scoping the operation to the right rows.
 *
 * It is never used to serve an ordinary customer request.
 */
export function createAdminClient() {
  return createSupabaseClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    requireServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
