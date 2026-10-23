// Production initial setup: loads the real site content into a deployed project.
//
//   pnpm content:setup --env .env.production.local
//
// Order, and why:
//   1. migrations must already be applied (`supabase db push`) — they create the
//      tables, the reference data (roles, permissions, tiers) and the buckets;
//   2. supabase/content/*.sql — products, curriculum, works, writing, team —
//      run here in ONE transaction, so a failure part-way leaves the database
//      exactly as it was;
//   3. scripts/import-images.mjs against the same project, which uploads the
//      whole migrated image library and links covers, gallery and team photos
//      to the rows step 2 created. It has to come after: it links by slug.
//   4. scripts/import-audio.mjs, which uploads the catalogue's hosted
//      recordings and attaches them to their works, for the same reason.
//
// seed.sql is NEVER run here. It holds local test accounts (password123) and
// placeholder rows, and nothing in it is true of production.
//
// Refuses to run twice. The content files are safe to repeat for most rows, but
// not all (prices have no natural key), so a second run is blocked unless
// --force is given — by which point someone has decided to, deliberately.
//
//   pnpm content:setup --env <file> --only 12_coaching_offer.sql
//
// --only runs ONE named file against a project that already holds the content,
// and nothing else: no other file, no media import. For a file written to be
// re-run (it says so at its head) — the way a later change to the offer reaches
// a database that was set up before it.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import postgres from "postgres";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const envFile = flag("--env") ? argv[argv.indexOf("--env") + 1] : null;

if (!envFile) {
  console.error("Usage: pnpm content:setup --env <env file for the target project> [--force]");
  console.error("There is no default: .env.local points at the local stack, which db reset already fills.");
  process.exit(1);
}

const env = Object.fromEntries(
  fs.readFileSync(envFile, "utf8").split("\n")
    .filter((l) => l && !l.trimStart().startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!env.SUPABASE_DB_URL) {
  console.error(`${envFile} needs SUPABASE_DB_URL (Supabase dashboard → Connect → direct connection string).`);
  process.exit(1);
}

const dir = "supabase/content";
const only = flag("--only") ? argv[argv.indexOf("--only") + 1] : null;
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
  .filter((f) => !only || f === only);
if (only && files.length === 0) {
  console.error(`No content file named ${only} in ${dir}.`);
  process.exit(1);
}
const sql = postgres(env.SUPABASE_DB_URL, { max: 1, onnotice: () => {} });

try {
  const [{ n }] = await sql`select count(*)::int as n from public.products`;
  if (n > 0 && !flag("--force") && !only) {
    console.error(`Target already has ${n} products — content looks loaded. Re-run with --force only if that is intended.`);
    process.exit(1);
  }

  await sql.begin(async (tx) => {
    for (const f of files) {
      process.stdout.write(`  ${f} ... `);
      await tx.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
      console.log("ok");
    }
  });
  console.log(`content: ${files.length} files applied in one transaction`);
} finally {
  await sql.end();
}

// One re-runnable file changes no media.
if (only) process.exit(0);

// Media last: it links to rows the content just created. Images, then the
// catalogue's hosted recordings (scripts/import-audio.mjs).
const images = spawnSync("node", ["scripts/import-images.mjs", "--env", envFile], { stdio: "inherit" });
if (images.status !== 0) process.exit(images.status ?? 1);
const audio = spawnSync("node", ["scripts/import-audio.mjs", "--env", envFile], { stdio: "inherit" });
process.exit(audio.status ?? 1);
