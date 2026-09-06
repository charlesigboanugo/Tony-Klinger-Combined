/**
 * Exercises the invitation path — note 06 §14.2.
 *
 * Asserts the three things that make an invitation different from "create a
 * user with a password": an account exists, an audit entry names the operator
 * and the reason, and an email actually left the building. The last one is read
 * out of the local mail catcher, because an invitation nobody receives is a
 * dead account, not a user.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/invite-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const MAIL = process.env.MAIL_URL ?? "http://127.0.0.1:54324";
const OWNER = "owner@test.local";
const PASS = "password123";
const INVITEE = `harness-${Date.now()}@test.local`;

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
};
const auth = (path, init = {}) =>
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { ...headers, ...init.headers } });
const rest = (path) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }).then((r) => r.json());

const users = await auth("/users?per_page=200").then((r) => r.json());
const owner = (users.users ?? []).find((u) => u.email === OWNER);
if (!owner) { console.log("FAIL: owner seed missing"); process.exit(1); }

for (const f of await auth(`/users/${owner.id}/factors`).then((r) => r.json()).then((d) => (Array.isArray(d) ? d : d.factors ?? []))) {
  await auth(`/users/${owner.id}/factors/${f.id}`, { method: "DELETE" });
}
step(`fixture: owner has no keys; inviting ${INVITEE}`);

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

await page.goto(`${BASE}/admin/users`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);
if (!here().startsWith("/admin/users")) await fail(`blocked at ${here()}`);

await page.getByRole("button", { name: /Invite someone/i }).click();
await page.fill('input[name="email"]', INVITEE);
await page.fill('input[name="displayName"]', "Harness Invitee");
await page.fill('input[name="reason"]', "Harness: verifying the invitation path");
await page.getByRole("button", { name: /Send invitation/i }).click();
await page.waitForTimeout(5000);

const formText = (await page.locator("form.max-w-lg").innerText()).replace(/\s+/g, " ");
step(`form says: ${formText.slice(0, 160)}`);

// 1. The account exists.
const after = await auth("/users?per_page=200").then((r) => r.json());
const invited = (after.users ?? []).find((u) => u.email === INVITEE);
if (!invited) await fail("no account was created");
if (invited.confirmed_at) await fail("the account was created already confirmed — that is not an invitation");

// 2. A profile was made, and the name carried through.
const profile = (await rest(`profiles?select=display_name&user_id=eq.${invited.id}`))[0];
if (!profile) await fail("no profile row");
step(`account created, unconfirmed, profile name "${profile.display_name}"`);

// 3. The audit names the operator and the reason.
const audit = (await rest(
  `audit_logs?select=action,reason,actor_user_id&resource_id=eq.${invited.id}&order=created_at.desc&limit=1`,
))[0];
if (audit?.action !== "user_invited") await fail(`no audit entry: ${JSON.stringify(audit)}`);
if (audit.actor_user_id !== owner.id) await fail("the audit entry names the wrong actor");
step(`audit: ${audit.action} by the owner — "${audit.reason}"`);

// 4. The email actually left, and its link goes somewhere useful.
const box = await fetch(`${MAIL}/api/v1/messages?limit=25`).then((r) => r.json()).catch(() => null);
const message = (box?.messages ?? []).find((m) =>
  (m.To ?? []).some((t) => t.Address === INVITEE),
);
if (!message) await fail("no invitation email was delivered");
step(`email delivered: "${message.Subject}"`);

const body = await fetch(`${MAIL}/api/v1/message/${message.ID}`).then((r) => r.json());
const link = (body.HTML ?? body.Text ?? "").match(/https?:\/\/[^\s"'<>]+/g)?.find((u) => u.includes("/auth/"));
if (!link) await fail("the invitation email carries no link");
if (!/reset-password/.test(decodeURIComponent(link))) {
  await fail(`the link does not lead to the password form: ${link}`);
}
step("link points at the password form");

// 5. Following it actually lands there, with wording for someone who has never
//    had a password.
const invitee = await browser.newContext();
const inviteePage = await invitee.newPage();
await inviteePage.goto(link.replace(/&amp;/g, "&"), { waitUntil: "domcontentloaded" });
await inviteePage.waitForLoadState("networkidle").catch(() => {});
const landed = inviteePage.url().replace(BASE, "");
const heading = await inviteePage.locator("h1").first().innerText().catch(() => "—");
step(`invitee landed on ${landed} — "${heading}"`);
if (!landed.startsWith("/auth/reset-password")) {
  await fail(`the invitation link did not reach the password form (${landed})`);
}
if (!/set your password/i.test(heading)) await fail(`wrong wording for an invitee: "${heading}"`);

// The invitation is only complete when the person holds a credential of their
// own. Set it, then prove it by signing in with it from a clean browser.
const chosen = "Harness-invitee-pw-1";
await inviteePage.fill('input[name="password"]', chosen);
await inviteePage.fill('input[name="confirmPassword"]', chosen);
await inviteePage.getByRole("button", { name: /Save|Update|Set/i }).first().click();
await inviteePage.waitForTimeout(4000);
step(`after setting a password: ${inviteePage.url().replace(BASE, "")}`);
await invitee.close();

const returning = await browser.newContext();
const returningPage = await returning.newPage();
await returningPage.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
await returningPage.fill('input[type="email"]', INVITEE);
await returningPage.fill('input[type="password"]', chosen);
await Promise.all([
  returningPage.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
  returningPage.getByRole("button", { name: "Sign in", exact: true }).click(),
]).catch(() => {});
const signedInAt = returningPage.url().replace(BASE, "");
await returning.close();
if (signedInAt.includes("/auth/sign-in")) await fail("the invitee cannot sign in with the password they set");
step(`invitee signs in with their own password, landing on ${signedInAt}`);

// 6. The invitee appears in search.
await page.goto(`${BASE}/admin/users?q=Harness+Invitee`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
if (!(await page.locator("td", { hasText: "Harness Invitee" }).count())) {
  await fail("the invited account does not appear in a search for its name");
}
step("search finds the invited account");

// Leave the seed as we found it.
await auth(`/users/${invited.id}`, { method: "DELETE" });
step(`PASS: invited, audited, emailed and searchable — test account removed`);

await browser.close();
