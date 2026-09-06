"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env/public";

/**
 * Supabase client for browser/Client Component use.
 *
 * Operates as the signed-in user and is subject to Row Level Security, which
 * is what makes it safe to expose. It is never the security boundary on its
 * own — the server re-checks every authorization decision (note 05 §14).
 */
export function createClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
