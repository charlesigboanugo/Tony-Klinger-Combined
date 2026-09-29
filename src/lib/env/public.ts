/**
 * Public environment. Safe to import from Client Components.
 *
 * Only NEXT_PUBLIC_* values belong here. Anything secret goes in `./server`,
 * which is guarded by `server-only` (note 09 §49).
 *
 * `process.env.NEXT_PUBLIC_*` must be referenced by its full literal name so
 * the bundler can inline it — destructuring `process.env` does not work.
 *
 * Checked by hand rather than with Zod: every stored image imports this, so a
 * Zod schema here put the whole library into every page's JavaScript (note 10
 * §47.3). The rules are the ones the schema had: two URLs and a key required,
 * the Stripe key optional but not empty. It still fails loudly at start-up.
 */

const raw = {
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
};

const isUrl = (value: string | undefined) => {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const problems = [
  !isUrl(raw.NEXT_PUBLIC_SITE_URL) && "NEXT_PUBLIC_SITE_URL must be a URL",
  !isUrl(raw.NEXT_PUBLIC_SUPABASE_URL) && "NEXT_PUBLIC_SUPABASE_URL must be a URL",
  !raw.NEXT_PUBLIC_SUPABASE_ANON_KEY && "NEXT_PUBLIC_SUPABASE_ANON_KEY is required",
  raw.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY === "" && "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must not be empty",
].filter(Boolean);

if (problems.length > 0) {
  throw new Error(`Invalid public environment:\n${problems.map((p) => `  ✖ ${p}`).join("\n")}`);
}

export const publicEnv = raw as {
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string;
};
