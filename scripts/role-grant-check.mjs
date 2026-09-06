/**
 * Exercises the role-assignment path end to end — note 06 §13, §13.1, §34.
 *
 * This is the most privileged thing the admin can do, and it is gated three
 * deep: an owner session, a SECOND security key (note 05 §11.1), and
 * `assert_admin_action('roles.manage')` inside the database. Asserting that the
 * form renders would prove none of that, so the script actually grants a role
 * and then reads the result back out of the database.
 *
 * Two virtual authenticators, because two keys means two DEVICES: Chrome allows
 * only one `internal` authenticator, so the spare presents itself over `usb`.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/role-grant-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OWNER = "owner@test.local";
const TARGET = "nobody@test.local";
const ROLE = "support_manager";
const PASS = "password123";

const step = (m) => console.log(m);
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
};
const auth = (path, init = {}) =>
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { ...headers, ...init.headers } });
const rest = (path) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }).then((r) => r.json());

const users = await auth("/users?per_page=200").then((r) => r.json());
const byEmail = (email) => (users.users ?? []).find((u) => u.email === email);

const owner = byEmail(OWNER);
const target = byEmail(TARGET);
if (!owner || !target) { console.log("FAIL: seeded accounts missing"); process.exit(1); }

// Fixture: clear the owner's stale factors, and the role we are about to grant.
for (const f of await auth(`/users/${owner.id}/factors`).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : d.factors ?? []))) {
  await auth(`/users/${owner.id}/factors/${f.id}`, { method: "DELETE" });
}
const roleRow = (await rest(`roles?select=id&name=eq.${ROLE}`))[0];
await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${target.id}&role_id=eq.${roleRow.id}`, {
  method: "DELETE",
  headers,
});
step(`fixture: ${OWNER} has no keys, ${TARGET} does not hold ${ROLE}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();

const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
const authenticators = {};
for (const transport of ["internal", "usb"]) {
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  authenticators[transport] = authenticatorId;
}

/*
  Both authenticators answer automatically, and the platform one answers first —
  so the spare enrolment was being handed to the device that already holds a
  credential, which correctly refuses with InvalidStateError. Silencing one
  makes "a different device" mean what it says.
*/
const only = async (transport) => {
  for (const [name, id] of Object.entries(authenticators)) {
    await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
      authenticatorId: id,
      enabled: name === transport,
    });
  }
};
const both = async () => {
  for (const id of Object.values(authenticators)) {
    await cdp.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId: id, enabled: true });
  }
};

const here = () => page.url().replace(BASE, "") || "/";

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

await both();

const keys = await page.locator("main li", { hasText: /Harness/ }).count();
if (keys < 2) await fail(`owner has ${keys} usable key(s); the two-key rule cannot be exercised`);
step(`owner holds ${keys} keys`);

// A fresh session, so the second factor is genuinely presented.
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 20000 }),
  page.getByRole("button", { name: /^Sign out$/i }).first().click(),
]);
await signIn(OWNER);

await page.goto(`${BASE}/admin/users/${target.id}`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
step(`owner reached ${here()}`);

if (!here().startsWith("/admin/users/")) await fail(`blocked at ${here()}`);

await page.selectOption("select#role", ROLE);
await page.fill('input[name="reason"]', "Harness: verifying the audited role path");
await page.getByRole("button", { name: /Apply change/i }).click();
await page.waitForTimeout(4000);

const message = await page.locator("form.max-w-lg").innerText();
step(`form says: ${message.split("\n").find((l) => /audit|error|Granted|No such/i.test(l)) ?? "(no message)"}`);

// The only proof that matters: the database.
const granted = await rest(`user_roles?select=user_id&user_id=eq.${target.id}&role_id=eq.${roleRow.id}`);
const audit = await rest(
  `audit_logs?select=action,reason,actor_user_id,metadata&resource_id=eq.${target.id}&order=created_at.desc&limit=1`,
);

if (granted.length !== 1) await fail("the role was not actually granted in the database");
if (audit[0]?.action !== "role_granted") await fail(`no audit entry: ${JSON.stringify(audit)}`);
if (audit[0].actor_user_id !== owner.id) await fail("the audit entry names the wrong actor");

step(`granted: audit says ${audit[0].action} by the owner — "${audit[0].reason}"`);

// And back again, so the check leaves the seed as it found it — and so the
// revoke direction is exercised rather than assumed to be symmetrical.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.selectOption("select#role", ROLE);
await page.check('input[name="grant"][value="revoke"]');
await page.fill('input[name="reason"]', "Harness: restoring the seed");
await page.getByRole("button", { name: /Apply change/i }).click();
await page.waitForTimeout(4000);

const stillHeld = await rest(
  `user_roles?select=user_id&user_id=eq.${target.id}&role_id=eq.${roleRow.id}`,
);
const revokeAudit = await rest(
  `audit_logs?select=action&resource_id=eq.${target.id}&order=created_at.desc&limit=1`,
);

if (stillHeld.length !== 0) await fail("the role was not revoked");
if (revokeAudit[0]?.action !== "role_revoked") await fail("the revoke was not audited");

step("revoked: audit says role_revoked, seed restored");
step(`PASS: ${ROLE} granted and revoked by an owner holding two keys, both audited`);

await browser.close();
