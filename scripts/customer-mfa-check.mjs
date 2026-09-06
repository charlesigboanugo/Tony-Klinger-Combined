/**
 * A CUSTOMER who has set up a key must be asked for it — note 05 §11.1.
 *
 * Until this change, MFA was computed for staff only, so a customer could
 * register a key and never once be challenged: the second factor they chose was
 * decorative. This checks the whole shape of the fix.
 *
 *   1. no key           sign-in goes straight through, nothing is asked
 *   2. key registered   the NEXT sign-in is challenged immediately, before any
 *                       page of the product
 *   3. abandoning it    leaves the account unreachable, rather than half-open
 *   4. admin reset      clears the keys, audited, and sign-in is plain again
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/customer-mfa-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CUSTOMER = "gold@test.local";
const OWNER = "owner@test.local";
const PASS = "password123";

const step = (m) => console.log(m);
let browser;
const fail = async (m) => { console.log(`FAIL: ${m}`); await browser?.close(); process.exit(1); };

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => /^[A-Z]/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(supabaseUrl ?? "")) {
  console.error(`Refusing to run: ${supabaseUrl} is not a local Supabase.`);
  process.exit(1);
}

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const auth = (path, init = {}) =>
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { ...headers, ...init.headers } });
const rest = (path) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }).then((r) => r.json());
const factorsOf = async (id) =>
  auth(`/users/${id}/factors`).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : d.factors ?? []));

const users = await auth("/users?per_page=200").then((r) => r.json());
const customer = (users.users ?? []).find((u) => u.email === CUSTOMER);
const owner = (users.users ?? []).find((u) => u.email === OWNER);
if (!customer || !owner) { console.log("FAIL: seeds missing"); process.exit(1); }

for (const who of [customer, owner]) {
  for (const f of await factorsOf(who.id)) {
    await auth(`/users/${who.id}/factors/${f.id}`, { method: "DELETE" });
  }
}
step("fixture: customer and owner both have no keys");

browser = await chromium.launch({ headless: true });

async function session() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2", transport: "internal", hasResidentKey: true,
      hasUserVerification: true, isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { context, page };
}

async function signIn(page, email) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
}

// 1. No key: nothing should be asked.
{
  const { context, page } = await session();
  await signIn(page, CUSTOMER);
  await page.waitForLoadState("networkidle").catch(() => {});
  const landed = page.url().replace(BASE, "");
  if (landed.startsWith("/auth/2fa")) await fail("a customer with no key was challenged");
  step(`no key: sign-in lands on ${landed}`);

  // Register one.
  await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 });
  await page.fill('input[placeholder="Laptop"]', "Customer laptop");
  await page.getByRole("button", { name: /Register a security key/i }).click();
  await page.waitForTimeout(5000);
  await context.close();
}

if ((await factorsOf(customer.id)).length !== 1) await fail("the customer's key did not register");
step("customer registered one key");

// 2. The next sign-in must be challenged, from the sign-in step itself.
{
  const { context, page } = await session();
  const trail = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) trail.push(f.url().replace(BASE, "") || "/");
  });

  await signIn(page, CUSTOMER);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);

  if (!trail.some((u) => u.startsWith("/auth/2fa"))) {
    await fail(`the customer was not challenged. Trail: ${trail.join(" → ")}`);
  }
  step(`challenged at sign-in — trail: ${trail.join("  →  ")}`);

  // 3. Abandoning it must not leave the account half-open. This browser's
  //    authenticator has no credential for the key registered in the other
  //    context, so the challenge cannot succeed here.
  await page.goto(`${BASE}/account/orders`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const reached = page.url().replace(BASE, "");
  if (!reached.startsWith("/auth/2fa")) {
    await fail(`an unverified customer session reached ${reached}`);
  }
  step("an unverified session is held at the challenge, not let into the account");

  const footer = await page.locator("body").innerText();
  if (!/Ask us to remove it/i.test(footer)) {
    await fail("the challenge offers a customer no way out");
  }
  step("the challenge tells a customer how to recover");
  await context.close();
}

// 4. An operator can hand the account back.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");

  // Two DEVICES, because the owner needs a spare (note 05 §11.1) and Chrome
  // allows only one `internal` authenticator. Only one answers at a time: both
  // respond automatically and the platform one responds first, so it would be
  // handed the spare enrolment it must refuse.
  const ids = {};
  for (const transport of ["internal", "usb"]) {
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2", transport, hasResidentKey: true,
        hasUserVerification: true, isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    ids[transport] = authenticatorId;
  }
  const only = async (which) => {
    for (const [name, id] of Object.entries(ids)) {
      await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
        authenticatorId: id,
        enabled: name === which,
      });
    }
  };

  await signIn(page, OWNER);
  for (const [transport, label] of [["internal", "Owner primary"], ["usb", "Owner spare"]]) {
    await only(transport);
    await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 });
    await page.fill('input[placeholder="Laptop"]', label);
    await page.getByRole("button", { name: /Register a security key/i }).click();
    await page.waitForTimeout(5000);
  }
  await only("internal");

  const ownerKeys = await factorsOf(owner.id);
  if (ownerKeys.length < 2) await fail(`owner holds ${ownerKeys.length} key(s); needs two`);

  await page.goto(`${BASE}/admin/users/${customer.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  if (!page.url().includes("/admin/users/")) await fail(`owner blocked at ${page.url()}`);

  const keysSection = page.locator("section", { hasText: "Security keys" }).last();
  step(`keys section before: ${(await keysSection.innerText()).replace(/\s+/g, " ").slice(0, 200)}`);

  await keysSection.getByRole("button", { name: /^Clear security keys$/i }).click();
  const resetForm = keysSection.locator("form");
  await resetForm.locator('input[name="reason"]').fill("Harness: customer lost their key");
  await resetForm.getByRole("button", { name: /^Clear all keys$/i }).click();
  await page.waitForTimeout(5000);
  step(`keys section after: ${(await keysSection.innerText()).replace(/\s+/g, " ").slice(0, 260)}`);

  const left = await factorsOf(customer.id);
  if (left.length !== 0) {
    step(`page says: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
    await fail(`${left.length} key(s) survived the reset`);
  }

  const audit = (await rest(
    `audit_logs?select=action,reason,actor_user_id&resource_id=eq.${customer.id}&order=created_at.desc&limit=1`,
  ))[0];
  if (audit?.action !== "mfa_reset") await fail(`no audit entry: ${JSON.stringify(audit)}`);
  if (audit.actor_user_id !== owner.id) await fail("the reset names the wrong actor");
  step(`keys cleared by the owner, audited — "${audit.reason}"`);
  await context.close();
}

// 5. And the customer is back to a plain sign-in.
{
  const { context, page } = await session();
  await signIn(page, CUSTOMER);
  await page.waitForLoadState("networkidle").catch(() => {});
  const landed = page.url().replace(BASE, "");
  if (landed.startsWith("/auth/2fa")) await fail("still challenged after the reset");
  step(`after the reset, sign-in lands on ${landed}`);
  await context.close();
}

for (const f of await factorsOf(owner.id)) {
  await auth(`/users/${owner.id}/factors/${f.id}`, { method: "DELETE" });
}
step("PASS: customers with a key are challenged at sign-in, held there, and recoverable");

await browser.close();
