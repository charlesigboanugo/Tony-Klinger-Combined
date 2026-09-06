/**
 * Exercises public team membership — note 06 §14.1.
 *
 * The claim being tested is that appearing on the team page is a PRESENTATION
 * choice: it must put a name on /about/team, it must grant nothing, and
 * unlinking must leave the published biography alone.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/team-link-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER = "owner@test.local";
const TARGET = "nobody@test.local";
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

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const auth = (path, init = {}) =>
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { ...headers, ...init.headers } });
const rest = (path, init) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, { headers, ...init }).then((r) => r.json());

const users = await auth("/users?per_page=200").then((r) => r.json());
const owner = (users.users ?? []).find((u) => u.email === OWNER);
const target = (users.users ?? []).find((u) => u.email === TARGET);
if (!owner || !target) { console.log("FAIL: seeds missing"); process.exit(1); }

for (const f of await auth(`/users/${owner.id}/factors`).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : d.factors ?? []))) {
  await auth(`/users/${owner.id}/factors/${f.id}`, { method: "DELETE" });
}
await fetch(`${supabaseUrl}/rest/v1/team_members?user_id=eq.${target.id}`, { method: "DELETE", headers });

const seeded = await rest("team_members?select=id,name,user_id");
step(`fixture: ${seeded.length} team entries, owner has no keys`);

browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();

const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
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
    await cdp.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId: id, enabled: name === which });
  }
};

async function signIn(email) {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
}
async function enrol(name) {
  await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 });
  await page.fill('input[placeholder="Laptop"]', name);
  await page.getByRole("button", { name: /Register a security key/i }).click();
  await page.waitForTimeout(5000);
}

await signIn(OWNER);
await only("internal");
await enrol("Harness primary");
await only("usb");
await enrol("Harness spare");

const shownAs = `Harness Teammate ${Date.now() % 100000}`;

await page.goto(`${BASE}/admin/users/${target.id}`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
if (!page.url().includes("/admin/users/")) await fail(`blocked at ${page.url()}`);

await page.fill('input[name="name"]', shownAs);
await page.fill('input[name="role"]', "Course tutor");
await page.getByRole("button", { name: /Add to the team page/i }).click();
await page.waitForTimeout(4000);

const created = (await rest(`team_members?select=id,name,slug,status,user_id&user_id=eq.${target.id}`))[0];
if (!created) await fail("no team entry was created");
if (created.status !== "published") await fail(`entry is ${created.status}, not published`);
step(`entry created: "${created.name}" (${created.slug}), ${created.status}`);

// It must actually appear on the public page.
const publicPage = await (await browser.newContext()).newPage();
await publicPage.goto(`${BASE}/about/team`, { waitUntil: "domcontentloaded" });
await publicPage.waitForLoadState("networkidle").catch(() => {});
const onSite = await publicPage.getByText(shownAs, { exact: false }).count();
if (onSite === 0) await fail("the new team member does not appear on /about/team");
step("appears on /about/team");

// It must grant nothing.
const rolesHeld = await rest(`user_roles?select=role_id&user_id=eq.${target.id}`);
if (rolesHeld.length !== 0) await fail("being on the team page granted a role");
step("granted no roles");

// Unlinking keeps the content.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.getByRole("button", { name: /Unlink from the team page/i }).click();
await page.waitForTimeout(4000);

const afterUnlink = (await rest(`team_members?select=id,user_id,status&id=eq.${created.id}`))[0];
if (!afterUnlink) await fail("unlinking deleted the published entry");
if (afterUnlink.user_id !== null) await fail("the account is still linked");
step("unlinked, entry preserved");

// Leave the seed as found.
await fetch(`${supabaseUrl}/rest/v1/team_members?id=eq.${created.id}`, { method: "DELETE", headers });
step("PASS: added, published, granted nothing, unlinked without losing content");

await browser.close();
