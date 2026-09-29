import "server-only";

import { createServerClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env/public";

/**
 * Supabase client for PUBLISHED content, with no visitor attached.
 *
 * Reads as `anon`, so RLS returns exactly what a signed-out visitor sees, and
 * the result is identical for everyone. That is what lets public pages be
 * pre-built and cached (note 10 §47.1): the cookie-bound client in `server.ts`
 * reads `cookies()`, which forces a page to render on every request.
 *
 * Never use this for anything that depends on who is asking.
 */
export function createPublicClient() {
  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}
