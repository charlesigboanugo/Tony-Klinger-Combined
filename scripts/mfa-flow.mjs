/**
 * Exercises the staff sign-in → second factor → admin path in a real browser.
 *
 * The point under test is that a session with a key on file is CHALLENGED as
 * PART OF SIGNING IN — not dropped on the settings page to find a button, and
 * not left until they happen to open a page that gates (note 05 §11.1).
 *
 * A CDP virtual authenticator stands in for a real security key. Its
 * credentials live and die with the browser process, so a key enrolled in an
 * earlier run is unusable here — the script therefore enrols its own, and
 * treats a pre-existing factor that will not respond as the very case the
 * "use another key" fallback exists for.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/mfa-flow.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.MFA_TEST_EMAIL ?? "admin@test.local";
const PASS = process.env.MFA_TEST_PASSWORD ?? "password123";

const step = (m) => console.log(m);

/*
  FIXTURE RESET.

  A virtual authenticator's credentials die with the browser, so every run
  leaves behind a factor no later run can satisfy — and Supabase refuses to
  enrol a SECOND factor from an `aal1` session (403), which is exactly the
  session a fresh sign-in has. Without this the harness bricks itself after one
  run. Local Supabase only; it refuses to touch anything else.
*/
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

const admin = (path, init = {}) =>
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

async function clearFactors(email) {
  const users = await admin("/users?per_page=200").then((r) => r.json());
  const user = (users.users ?? []).find((u) => u.email === email);
  if (!user) throw new Error(`No such user: ${email}`);

  const listed = await admin(`/users/${user.id}/factors`).then((r) => r.json());
  const factors = Array.isArray(listed) ? listed : (listed.factors ?? []);
  for (const factor of factors) {
    await admin(`/users/${user.id}/factors/${factor.id}`, { method: "DELETE" });
  }
  step(`fixture: removed ${factors.length} stale factor(s) from ${email}`);
}

await clearFactors(EMAIL);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();

const trail = [];
page.on("framenavigated", (f) => {
  if (f === page.mainFrame()) trail.push(f.url().replace(BASE, "") || "/");
});
page.on("pageerror", (e) => step(`[pageerror] ${e.message}`));

const cdp = await context.newCDPSession(page);
await cdp.send("WebAuthn.enable");
await cdp.send("WebAuthn.addVirtualAuthenticator", {
  options: {
    protocol: "ctap2",
    transport: "internal",
    hasResidentKey: true,
    hasUserVerification: true,
    isUserVerified: true,
    automaticPresenceSimulation: true,
  },
});

async function signIn() {
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
}

const here = () => page.url().replace(BASE, "") || "/";

/** What the browser's access token actually claims, as the server will read it. */
async function tokenClaims() {
  const cookies = await context.cookies();
  const chunks = cookies
    .filter((c) => /auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => c.value)
    .join("");
  const raw = chunks.startsWith("base64-")
    ? Buffer.from(chunks.slice(7), "base64").toString("utf8")
    : decodeURIComponent(chunks);
  try {
    const jwt = JSON.parse(raw).access_token;
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64").toString("utf8"));
    return { aal: payload.aal, amr: (payload.amr ?? []).map((e) => e.method) };
  } catch {
    return { aal: "?", amr: [] };
  }
}

// 1. A key-less staff session must be sent to ENROL, not challenged.
await signIn();
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
step(`GET /admin with no keys → ${here()}`);
if (!here().startsWith("/account/security/mfa")) {
  step("FAIL: a key-less account should be sent to enrolment");
  await browser.close();
  process.exit(1);
}

const keyName = `Harness ${Date.now()}`;
await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 }).catch(async () => {
  step(`enrol form missing. Page says: ${(await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 500)}`);
});
await page.fill('input[placeholder="Laptop"]', keyName);
await page.getByRole("button", { name: /Register a security key/i }).click();
await page.waitForTimeout(5000);
step(`enrolled "${keyName}"`);

// 2. A fresh session: aal1, with keys on file. This is the case the change is about.
/*
  A REAL sign-out, not `clearCookies()`. The browser client keeps the session in
  its own storage and writes it back into cookies on the next page load, so
  clearing cookies silently restores the previous `aal2` session a moment later
  and the next assertion tests nothing.
*/
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await Promise.all([
  page.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 20000 }),
  page.getByRole("button", { name: /^Sign out$/i }).first().click(),
]);
await page.goto(`${BASE}/account`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});
step(`after signing out, /account → ${here()}`);

trail.length = 0;
await signIn();
await page.waitForLoadState("networkidle").catch(() => {});
await page.waitForTimeout(1500);

step(`sign-in trail: ${trail.join("  →  ")}`);
step(`token after sign-in: ${JSON.stringify(await tokenClaims())}`);

const challenged = trail.some((u) => u.startsWith("/auth/2fa"));
if (!challenged) {
  step("FAIL: signing in did not raise the challenge");
  await browser.close();
  process.exit(1);
}

const claimsNow = await tokenClaims();
if (claimsNow.aal !== "aal2") {
  step(`FAIL: still ${claimsNow.aal} after the challenge`);
  await browser.close();
  process.exit(1);
}

// Admin should now be reachable with no further interruption.
trail.length = 0;
await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {});

if (!here().startsWith("/admin")) {
  step(`FAIL: stuck at ${here()}`);
  await browser.close();
  process.exit(1);
}
if (trail.some((u) => u.startsWith("/auth/2fa"))) {
  step("FAIL: challenged a second time for the same session");
  await browser.close();
  process.exit(1);
}

step(`PASS: challenged during sign-in, verified without a click, /admin reached directly`);
step(`h1: ${await page.locator("h1").first().innerText().catch(() => "—")}`);

await browser.close();
