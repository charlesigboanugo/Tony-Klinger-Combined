#!/usr/bin/env node
/**
 * Responsive and visual verification — note 10 §48, §49.
 *
 * Renders routes at real device viewports, screenshots them, and fails on
 * horizontal overflow.
 *
 * WHY THIS EXISTS AS A SCRIPT. Chrome's `--screenshot` with `--window-size`
 * does NOT set the layout viewport in the current build — it lays out at
 * ~800px and crops the image to the requested width. That produced a
 * convincing-looking "overflow bug" on every page that did not exist. A real
 * browser viewport is the only trustworthy way to check responsive layout, so
 * checking it by eye from cropped screenshots is worse than not checking.
 *
 * It also runs JavaScript, so interactive state can be exercised rather than
 * assumed — see the `--interact` pass.
 *
 * Requires the three shared libraries Chromium needs. They are installed
 * per-user (no root) at ~/.local/lib/browser-deps; this script puts them on
 * the path itself, so no wrapper is needed:
 *
 *   node scripts/visual-check.mjs                 # sweep, all viewports
 *   node scripts/visual-check.mjs --shot /blog    # one route, desktop + mobile
 *   node scripts/visual-check.mjs --interact      # exercise the price toggle
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEPS = join(homedir(), ".local", "lib", "browser-deps");
process.env.LD_LIBRARY_PATH = `${DEPS}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = process.env.SHOT_DIR ?? "/mnt/c/Users/USER/tk-shots";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
];

/** Public routes. Authenticated areas redirect and are covered separately. */
const ROUTES = [
  "/",
  "/about",
  "/about/team",
  "/about/testimonials",
  "/blog",
  "/catalogue",
  "/catalogue/books",
  "/catalogue/films",
  "/catalogue/audio",
  "/catalogue/watch",
  "/coaching",
  "/coaching/about",
  "/coaching/memberships",
  "/coaching/courses",
  "/coaching/group-coaching",
  "/coaching/cohorts",
  "/coaching/private-coaching",
  "/coaching/retreats",
  "/give-get-go",
  "/events",
  "/contact",
  "/privacy",
  "/terms",
  "/cookies",
  "/cart",
  "/checkout",
  "/academy",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/forgot-password",
];

const args = process.argv.slice(2);
const shotOnly = args.includes("--shot") ? args[args.indexOf("--shot") + 1] : null;
const interact = args.includes("--interact");
const dark = args.includes("--dark");
const scheme = dark ? "dark" : "light";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

let failures = 0;

/** Measure overflow and name the widest offending element. */
async function measure(page, width) {
  return page.evaluate((vw) => {
    const sw = document.documentElement.scrollWidth;
    let worst = null;
    if (sw > vw + 1) {
      let widest = 0;
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && r.width > widest) {
          widest = r.width;
          worst = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 70)} (w=${Math.round(r.width)}, right=${Math.round(r.right)})`;
        }
      }
    }
    return { sw, worst };
  }, width);
}

if (shotOnly) {
  for (const vp of VIEWPORTS.filter((v) => v.name !== "tablet")) {
    const page = await browser.newPage({ viewport: vp, colorScheme: scheme });
    await page.goto(BASE + shotOnly, { waitUntil: "networkidle" });

    // Scroll the whole page and come back. Reveal-on-scroll content is only
    // brought in when it intersects, so a capture taken without scrolling
    // shows empty sections that a real visitor would never see.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 350));
    });

    const name = (shotOnly.replace(/\//g, "_") || "_home") + (dark ? "-dark" : "");
    await page.screenshot({
      path: `${OUT}/${name}-${vp.name}.png`,
      fullPage: vp.name === "desktop",
    });
    const { sw, worst } = await measure(page, vp.width);
    console.log(
      `${vp.name.padEnd(8)} ${shotOnly.padEnd(28)} scrollW=${sw} ${sw > vp.width + 1 ? "OVERFLOW " + worst : "ok"}`,
    );
    await page.close();
  }
} else if (interact) {
  // Exercise the billing toggle for real, rather than trusting the unit maths.
  const page = await browser.newPage({ viewport: VIEWPORTS[2] });
  await page.goto(BASE + "/coaching/memberships", { waitUntil: "networkidle" });

  const read = () =>
    page.$$eval("ol > li", (lis) =>
      lis.map((li) => {
        const h = li.querySelector("h2")?.textContent?.trim();
        const price = li.querySelector(".tabular-nums")?.textContent?.trim();
        const per = li.querySelector(".tabular-nums + span")?.textContent?.trim();
        return `${h}: ${price ?? "—"} ${per ?? ""}`.trim();
      }),
    );

  console.log("monthly (default):");
  for (const r of await read()) console.log("   " + r);

  await page.getByRole("radio", { name: "One year" }).click();
  await page.waitForTimeout(400);

  console.log("after clicking 'One year':");
  for (const r of await read()) console.log("   " + r);

  await page.screenshot({ path: `${OUT}/toggle-yearly.png`, fullPage: false });
  await page.close();
} else {
  for (const vp of VIEWPORTS) {
    console.log(`\n=== ${vp.name} (${vp.width}px) ===`);
    const page = await browser.newPage({ viewport: vp });
    for (const route of ROUTES) {
      try {
        const res = await page.goto(BASE + route, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await page.waitForTimeout(250);
        const { sw, worst } = await measure(page, vp.width);
        const over = sw > vp.width + 1;
        if (over) failures++;
        const status = res?.status() ?? 0;
        if (over || status >= 400) {
          console.log(
            `  ${over ? "OVERFLOW" : "HTTP " + status}  ${route}  scrollW=${sw}  ${worst ?? ""}`,
          );
        }
      } catch (e) {
        failures++;
        console.log(`  ERROR     ${route}  ${e.message.split("\n")[0]}`);
      }
    }
    console.log(`  (${ROUTES.length} routes checked)`);
    await page.close();
  }
  console.log(
    failures === 0
      ? "\nNo horizontal overflow at any viewport.\n"
      : `\n${failures} problem(s).\n`,
  );
}

await browser.close();
process.exit(failures === 0 ? 0 : 1);
