/**
 * Exercises the Academy delivery path — note 07 §32, §R29.
 *
 * Four things have to be true and only one of them is visible on screen:
 *
 *   1. an entitled customer can play a lesson
 *   2. the embed URL NEVER reaches anyone unentitled — not in the markup, not
 *      in the RSC payload, not anywhere
 *   3. completion is recorded, and shown back on the course and on Progress
 *   4. progress cannot be forged for a lesson the caller is not entitled to
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/academy-check.mjs
 */
import { readFileSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ENTITLED = "gold@test.local";
const OUTSIDER = "nobody@test.local";
const PASS = "password123";
const COURSE = "level-one";

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
const rest = (path) => fetch(`${supabaseUrl}/rest/v1/${path}`, { headers }).then((r) => r.json());

const seeded = await rest(
  "lessons?select=id,title,slug,video_id,video_provider&video_id=not.is.null&order=position",
);
if (seeded.length === 0) { console.log("FAIL: no lesson has video seeded"); process.exit(1); }

// One lesson per host, so a provider added later cannot quietly go untested.
const byProvider = new Map();
for (const lesson of seeded) {
  if (!byProvider.has(lesson.video_provider)) byProvider.set(lesson.video_provider, lesson);
}
const videoLesson = seeded[0];
step(
  `fixture: ${seeded.length} lessons carry video across ${[...byProvider.keys()].join(", ")}`,
);

const PLAYER_HOST = {
  vimeo: "player.vimeo.com/video/",
  youtube: "www.youtube-nocookie.com/embed/",
  livid: "embed.livid.tv/",
};

browser = await chromium.launch({ headless: true });

async function signedIn(email) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);
  return { context, page };
}

const lessonPath = `/academy/courses/${COURSE}/lessons/${videoLesson.slug}`;

// 1 & 3. The entitled customer.
{
  const { context, page } = await signedIn(ENTITLED);

  await page.goto(`${BASE}${lessonPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // Every host, not just the first: an embed URL built wrong renders an empty
  // black box that looks like a slow network.
  for (const [provider, lesson] of byProvider) {
    await page.goto(`${BASE}/academy/courses/${COURSE}/lessons/${lesson.slug}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("networkidle").catch(() => {});

    const frame = page.locator("iframe[title$='video']");
    if ((await frame.count()) === 0) await fail(`no player rendered for ${provider}`);
    const src = await frame.first().getAttribute("src");
    const expected = `${PLAYER_HOST[provider]}${lesson.video_id}`;
    if (!src?.includes(expected)) {
      await fail(`${provider}: expected ${expected}, got ${src}`);
    }
    step(`entitled: ${provider} player renders — ${src.split("?")[0]}`);
  }

  await page.goto(`${BASE}${lessonPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});

  // The frame must actually load, which is where a CSP mistake shows up.
  const consoleErrors = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  const blocked = consoleErrors.filter((t) => /Content Security Policy|Refused to frame/i.test(t));
  if (blocked.length) await fail(`CSP blocked the player: ${blocked[0]}`);
  step("entitled: no CSP refusal for the player origin");

  // Mark complete.
  await page.getByRole("button", { name: /^Mark as complete$/i }).click();
  await page.waitForTimeout(3000);
  if ((await page.getByText("Completed", { exact: false }).count()) === 0) {
    await fail("completion was not reflected on the lesson");
  }
  step("entitled: lesson marked complete");

  // It must show on the course outline and on the dashboard — there is no
  // standalone Progress page (removed: progress is tracked within each
  // course's own content and summarised on the dashboard, never a separate
  // destination).
  await page.goto(`${BASE}/academy/courses/${COURSE}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const summary = await page.locator("main").innerText();
  if (!/1 of \d+ lessons done/.test(summary)) {
    await fail(`the course does not report the completion: ${summary.slice(0, 200)}`);
  }
  step(`course outline: ${summary.match(/\d+ of \d+ lessons done/)?.[0]}`);

  await page.goto(`${BASE}/academy`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const dashboardText = await page.locator("main").innerText();
  if (!/of \d+ lessons/.test(dashboardText)) {
    await fail(`dashboard does not show course progress: ${dashboardText.slice(0, 200)}`);
  }
  step(`dashboard: ${dashboardText.split("\n").find((l) => /of \d+ lessons/.test(l))}`);

  // Undo, so the check is repeatable.
  await page.goto(`${BASE}${lessonPath}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /^Mark as not done$/i }).click();
  await page.waitForTimeout(3000);
  await context.close();
}

// 2. The outsider must not receive the URL in ANY form.
{
  const { context, page } = await signedIn(OUTSIDER);

  const response = await page.goto(`${BASE}${lessonPath}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const status = response?.status();
  const body = await page.content();

  for (const host of Object.values(PLAYER_HOST)) {
    if (body.includes(host)) await fail(`a player address (${host}) reached an unentitled customer`);
  }
  for (const lesson of seeded) {
    if (body.includes(lesson.video_id)) {
      await fail("a video id reached a customer with no entitlement");
    }
  }
  step(`outsider: ${status} at ${page.url().replace(BASE, "")}, no video address in the document`);

  // And the course page must explain rather than 404 into silence.
  await page.goto(`${BASE}/academy/courses/${COURSE}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const text = await page.locator("main").innerText();
  if (!/don't have access|access to this course/i.test(text)) {
    await fail(`no explanation for an unentitled customer: ${text.slice(0, 200)}`);
  }
  for (const host of Object.values(PLAYER_HOST)) {
    if (text.includes(host)) await fail(`video address (${host}) leaked on the course page`);
  }
  step("outsider: told why, shown no addresses");
  await context.close();
}

// 4. Progress cannot be forged from outside an entitlement.
{
  const forged = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: OUTSIDER, password: PASS }),
  }).then((r) => r.json());

  const attempt = await fetch(`${supabaseUrl}/rest/v1/lesson_progress`, {
    method: "POST",
    headers: {
      apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${forged.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lesson_id: videoLesson.id }),
  });

  if (attempt.ok) await fail("an unentitled account wrote progress for a lesson it cannot see");
  step(`forged progress refused by the database: ${attempt.status}`);
}

step("PASS: video plays for the entitled, is withheld from everyone else, and progress is real");
await browser.close();
