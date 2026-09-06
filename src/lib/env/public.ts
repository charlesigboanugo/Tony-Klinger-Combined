import { z } from "zod";

/**
 * Public environment. Safe to import from Client Components.
 *
 * Only NEXT_PUBLIC_* values belong here. Anything secret goes in `./server`,
 * which is guarded by `server-only` (note 09 §49).
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced by its full literal name so
 * the bundler can inline it — destructuring `process.env` does not work.
 */
const schema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid public environment:\n${z.prettifyError(parsed.error)}`,
  );
}

export const publicEnv = parsed.data;
