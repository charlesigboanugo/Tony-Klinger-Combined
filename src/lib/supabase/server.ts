import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { publicEnv } from "@/lib/env/public";
import { visitorHeaders } from "@/lib/supabase/forwarded";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Runs as the authenticated user with RLS applied (note 05 §13).
 *
 * `cookies()` is asynchronous in Next.js 16 — synchronous access was removed.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const incoming = await headers();

  return createServerClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: visitorHeaders(incoming) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. Session refresh happens in
            // `src/proxy.ts`, so ignoring this is safe: the refreshed cookies
            // are written there on every matched request.
          }
        },
      },
    },
  );
}

/**
 * The trusted current user, verified against the Supabase Auth server.
 *
 * Use this — never `getSession()` — for any authorization decision. A session
 * read from cookies is not revalidated and must not be trusted server-side
 * (note 05 §12).
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
