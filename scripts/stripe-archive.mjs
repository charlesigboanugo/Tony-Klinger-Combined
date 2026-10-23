// Archive the Stripe catalogue, for a clean slate after a reset (owner,
// 2026-10-23). Then `pnpm stripe:sync` (or the test site's hourly job) builds a
// fresh set, as it would for a new project.
//
//   pnpm stripe:archive                          local: the Stripe key in .env.local, the local database
//   pnpm stripe:archive --env .env.remote.local  the TEST deployment: that file's Stripe key, the test database
//   … --unlinked   only products that no site product owns (no `product_id` in their metadata:
//                  the one-off products Stripe makes for a purchase before the sync has run)
//   … --yes        skip the "type yes" question
//
// TEST MODE ONLY: refuses any Stripe key that is not `sk_test_…`, and any
// database but local or the test project (scripts/lib/targets.mjs).
//
// Stripe keeps products that have been paid for, so "clearing" is archiving:
// archived products and prices leave the active catalogue and can't be bought.
// Unless --unlinked, the database's links to them (`products.stripe_product_id`,
// `prices.stripe_price_id`) are cleared too; otherwise the next sync would try
// to reuse the archived ones instead of making new ones.
import readline from "node:readline/promises";

import postgres from "postgres";
import Stripe from "stripe";

import { target } from "./lib/targets.mjs";

const argv = process.argv.slice(2);
const { local, envFile, env, dbUrl, ssl } = target(argv);
const unlinked = argv.includes("--unlinked");

const key = env.STRIPE_SECRET_KEY;
if (!key) {
  console.error(`${envFile} has no STRIPE_SECRET_KEY${local ? "" : " (the test deployment's Stripe sandbox key)"}.`);
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.error("Refused: that is not a Stripe TEST key. This never runs against live Stripe.");
  process.exit(1);
}

const stripe = new Stripe(key);

const products = [];
for await (const product of stripe.products.list({ active: true, limit: 100 })) {
  if (unlinked && product.metadata?.product_id) continue;
  products.push(product);
}

console.log(`Target: ${local ? "LOCAL" : "TEST deployment"} — Stripe test sandbox ${key.slice(0, 14)}…`);
console.log(`${products.length} active product${products.length === 1 ? "" : "s"} to archive${unlinked ? " (only those no site product owns)" : ""}.`);
for (const p of products.slice(0, 12)) console.log(`  ${p.name}`);
if (products.length > 12) console.log(`  … and ${products.length - 12} more`);
if (!unlinked) console.log(`The ${local ? "local" : "test"} database's Stripe links will be cleared, so the next sync makes a fresh set.`);

if (products.length === 0 && unlinked) process.exit(0);
if (!argv.includes("--yes")) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Type "yes" to go ahead: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Nothing changed.");
    process.exit(0);
  }
}

let archived = 0, prices = 0;
for (const product of products) {
  // The product first: a product's default price can't be archived while the
  // product is active, and an archived product can't be bought either way.
  await stripe.products.update(product.id, { active: false });
  archived += 1;
  for await (const price of stripe.prices.list({ product: product.id, active: true, limit: 100 })) {
    try {
      await stripe.prices.update(price.id, { active: false });
      prices += 1;
    } catch {
      // The product's default price: left as it is, on an archived product.
    }
  }
}
console.log(`Archived ${archived} products and ${prices} prices.`);

if (!unlinked) {
  const sql = postgres(dbUrl, { max: 1, onnotice: () => {}, ...(ssl ? { ssl } : {}) });
  try {
    const [p] = await sql`update public.products set stripe_product_id = null where stripe_product_id is not null returning 1`.then((r) => [r.length]);
    const [q] = await sql`update public.prices set stripe_price_id = null where stripe_price_id is not null returning 1`.then((r) => [r.length]);
    console.log(`Cleared ${p} product and ${q} price links in the ${local ? "local" : "test"} database.`);
  } finally {
    await sql.end();
  }
  console.log(local ? "Next: pnpm stripe:sync (with the dev server running)." : "Next: the test site's hourly sync, or call its /api/cron/sync-stripe.");
}
