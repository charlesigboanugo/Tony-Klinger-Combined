/**
 * Exercises revoking and adjusting access end to end, by role — note 06 §23.1.
 *
 * Three temporary staff accounts, each with a virtual security key:
 *   - admin            sees Change; adjusts, then revokes (asked first); the
 *                      database and the audit log are read back.
 *   - support_manager  may adjust but not revoke: the dialog has no Revoke.
 *   - finance_manager  may only look: no Change button at all.
 * It also checks a person's Access rows show what the access is to by name,
 * that the Entitlements page has no "All entitlements" button, and that the
 * flat list it led to is deleted.
 *
 * LOCAL Supabase only. Everything it creates is deleted at the end.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/entitlement-change-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASS = "password123";
const REASON = "Entitlement change check";

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
  fetch(`${supabaseUrl}/auth/v1/admin${path}`, { ...init, headers: { ...headers, ...init.headers } }).then((r) => r.json());
const rest = (path, init = {}) =>
  fetch(`${supabaseUrl}/rest/v1/${path}`, { ...init, headers: { ...headers, Prefer: "return=representation", ...init.headers } })
    .then(async (r) => {
      const text = await r.text();
      return text ? JSON.parse(text) : null;
    });

let failed = false;
const step = (m) => console.log(m);
const check = (ok, m) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${m}`);
  if (!ok) failed = true;
};

const ROLES = ["admin", "support_manager", "finance_manager"];
const emailFor = (role) => `tmp-ent-${role.replace(/_/g, "-")}@test.local`;

const users = (await auth("/users?per_page=1000")).users ?? [];
const customer = users.find((u) => u.email === "fresh@test.local");
if (!customer) {
  console.log("FAIL: fresh@test.local is missing; run `pnpm dev:samples` first");
  process.exit(1);
}

// Fixture: one temporary account per role, and one entitlement to change.
const staff = {};
for (const role of ROLES) {
  for (const u of users.filter((x) => x.email === emailFor(role))) await auth(`/users/${u.id}`, { method: "DELETE" });
  const created = await auth("/users", {
    method: "POST",
    body: JSON.stringify({ email: emailFor(role), password: PASS, email_confirm: true }),
  });
  const roleRow = (await rest(`roles?select=id&name=eq.${role}`))[0];
  await rest("user_roles", { method: "POST", body: JSON.stringify({ user_id: created.id, role_id: roleRow.id }) });
  staff[role] = created;
}
const service = (await rest("private_coaching_services?select=id,name&limit=1"))[0];
const fixture = (
  await rest("entitlements", {
    method: "POST",
    body: JSON.stringify({
      user_id: customer.id,
      resource_type: "private_coaching",
      resource_id: service.id,
      source_type: "admin_grant",
      status: "active",
      quantity: 3,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      granted_by: staff.admin.id,
      grant_reason: REASON,
    }),
  })
)[0];
step(`fixture: ${service.name}, 3 sessions, for fresh@test.local`);

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

/** A signed-in staff page with a virtual key enrolled, so the session is aal2. */
async function staffPage(role) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  await page.goto(`${BASE}/auth/sign-in`);
  await page.getByRole("tab", { name: "Password" }).click();
  await page.fill('input[type="email"]', emailFor(role));
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 30000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  await page.goto(`${BASE}/admin`);
  if (page.url().includes("/mfa")) {
    await page.waitForTimeout(2000);
    const name = page.locator('input[placeholder="Laptop"]');
    if (await name.count()) await name.fill("Harness");
    await page.getByRole("button", { name: /Register/i }).first().click();
    await page.waitForTimeout(7000);
  }
  return page;
}

const holders = `/admin/entitlements/private_coaching/${service.id}`;
const open = async (page, path) => {
  await page.goto(`${BASE}${path}`);
  await page.waitForLoadState("networkidle").catch(() => {});
};
const fixtureRow = (page) => page.locator("tr", { hasText: REASON });
const db = async () => (await rest(`entitlements?select=quantity,status,expires_at&id=eq.${fixture.id}`))[0];

try {
  // Finance: looks, changes nothing.
  {
    const page = await staffPage("finance_manager");
    await open(page, holders);
    check(page.url().includes(holders), "finance manager can open the holders page");
    check((await fixtureRow(page).count()) === 1, "finance manager sees the entitlement");
    check((await page.getByRole("button", { name: "Change" }).count()) === 0, "finance manager has no Change button");
    await page.context().close();
  }

  // Support: adjusts, cannot revoke.
  {
    const page = await staffPage("support_manager");
    await open(page, `/admin/users/${customer.id}`);
    check((await fixtureRow(page).locator("td").first().innerText()).includes(service.name), `a person's Access row names it "${service.name}"`);
    await fixtureRow(page).getByRole("button", { name: "Change" }).click();
    const dialog = page.locator("dialog[open]").first();
    await dialog.waitFor();
    check((await dialog.getByRole("button", { name: "Revoke access" }).count()) === 0, "support's dialog has no Revoke");
    check((await dialog.getByRole("heading", { name: service.name }).count()) === 1, "the dialog is titled by the product's name");
    await dialog.locator('input[name="quantity"]').fill("4");
    await dialog.locator('input[name="reason"]').fill("Check: support adds a session");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await page.waitForTimeout(3000);
    check((await db()).quantity === 4, "support's adjustment is saved (3 → 4 sessions)");
    await page.context().close();
  }

  // Admin: adjusts the end date, then revokes.
  {
    const page = await staffPage("admin");
    await open(page, "/admin/entitlements");
    check((await page.getByRole("link", { name: "All entitlements" }).count()) === 0, 'Entitlements has no "All entitlements" button');
    const gone = await page.goto(`${BASE}/admin/entitlements/all`);
    // The dev server streams its not-found page with a 200, so read the page.
    const heading = await page.locator("h1").first().innerText().catch(() => "");
    check(gone?.status() === 404 || /couldn.t find/i.test(heading), "the old flat list /admin/entitlements/all is gone");

    await open(page, holders);
    await fixtureRow(page).getByRole("button", { name: "Change" }).click();
    const dialog = page.locator("dialog[open]").first();
    await dialog.waitFor();
    check((await dialog.locator('input[name="quantity"]').inputValue()) === "4", "Adjust opens on the current number of sessions");
    await dialog.locator('input[name="expiresAt"]').fill("2026-12-31");
    await dialog.locator("form").first().locator('input[name="reason"]').fill("Check: admin moves the end date");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await page.waitForTimeout(3000);
    check((await db()).expires_at?.startsWith("2026-12-31"), "the new end date is saved");

    await dialog.locator("form").nth(1).locator('input[name="reason"]').fill("Check: admin revokes");
    await dialog.getByRole("button", { name: "Revoke access" }).click();
    await page.getByRole("button", { name: "Yes, revoke it" }).click();
    await page.waitForTimeout(3500);
    const after = await db();
    check(after?.status === "revoked", "the revoke is saved, and the record kept");
    check((await fixtureRow(page).getByRole("button", { name: "Change" }).count()) === 0, "a revoked row offers no Change");

    const audit = (await rest(`audit_logs?select=action&resource_id=eq.${fixture.id}&order=created_at`)).map((a) => a.action);
    check(
      audit.join(",") === "entitlement_adjusted,entitlement_adjusted,entitlement_revoked",
      `all three changes are audited (${audit.join(", ")})`,
    );
    await page.context().close();
  }
} finally {
  await browser.close();
  await rest(`audit_logs?resource_id=eq.${fixture.id}`, { method: "DELETE" });
  await rest(`entitlements?id=eq.${fixture.id}`, { method: "DELETE" });
  for (const u of Object.values(staff)) await auth(`/users/${u.id}`, { method: "DELETE" });
  step("cleaned up: temporary accounts, the entitlement and its audit rows");
}

step(failed ? "FAIL" : "PASS");
process.exit(failed ? 1 : 0);
