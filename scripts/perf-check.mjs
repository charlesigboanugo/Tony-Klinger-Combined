#!/usr/bin/env node
/**
 * Page weight and load timing — note 10 §47.
 *
 * Speed is a stated priority, and the two heavy dependencies on this site
 * (three.js and GSAP) are only defensible if they stay OUT of the shared
 * bundle. This measures whether that is actually true rather than assuming it:
 * it records every response a route transfers, and reports whether the gsap or
 * three chunks were fetched on routes that should not need them.
 *
 * Run against a PRODUCTION build. Dev serves unminified modules with HMR
 * attached, so numbers taken there mean nothing.
 *
 *   pnpm build && npx next start -p 3100
 *   BASE_URL=http://localhost:3100 node scripts/perf-check.mjs
 */

import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.LD_LIBRARY_PATH = `${join(homedir(), ".local", "lib", "browser-deps")}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const BASE = process.env.BASE_URL ?? "http://localhost:3100";

const ROUTES = [
  "/",
  "/blog",
  "/catalogue",
  "/catalogue/books",
  "/coaching",
  "/coaching/memberships",
  "/about",
  "/contact",
];

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

console.log(`\nPAGE WEIGHT (production build)\n`);
console.log(
  `${"route".padEnd(26)} ${"JS".padStart(7)} ${"IMG".padStart(7)} ${"FONT".padStart(7)} ${"TOTAL".padStart(8)}  ${"DCL".padStart(6)}  heavy libs`,
);
console.log("-".repeat(96));

for (const route of ROUTES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Which chunks contain the heavy libraries. Chunk filenames are hashed, so
  // the only reliable test is what is INSIDE them.
  const heavy = new Set();
  page.on("response", async (res) => {
    if (res.request().resourceType() !== "script") return;
    try {
      const body = (await res.body()).toString("utf8", 0, 200000);
      if (/gsap|ScrollTrigger/.test(body)) heavy.add("gsap");
      if (/THREE\.|WebGLRenderer/.test(body)) heavy.add("three");
    } catch {
      /* response gone; not worth failing over */
    }
  });

  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  /*
    encodedBodySize is the number that matters: bytes actually sent over the
    wire, after compression. `content-length` is often absent on streamed
    responses and `res.body()` is decompressed, so both overstate the cost —
    the earlier run reported ~763KB of JS that is really a fraction of that.
  */
  const stats = await page.evaluate(() => {
    const out = { js: 0, img: 0, font: 0, css: 0, other: 0 };
    for (const e of performance.getEntriesByType("resource")) {
      const n = e.encodedBodySize || 0;
      if (e.initiatorType === "script" || /\.js(\?|$)/.test(e.name)) out.js += n;
      else if (e.initiatorType === "img" || /\.(png|jpe?g|webp|avif|gif|svg)/.test(e.name)) out.img += n;
      else if (/\.(woff2?|ttf|otf)/.test(e.name)) out.font += n;
      else if (e.initiatorType === "link" || /\.css(\?|$)/.test(e.name)) out.css += n;
      else out.other += n;
    }
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      ...out,
      doc: nav ? nav.encodedBodySize || 0 : 0,
      dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
    };
  });

  const total = stats.js + stats.img + stats.font + stats.css + stats.other + stats.doc;
  console.log(
    `${route.padEnd(26)} ${kb(stats.js).padStart(7)} ${kb(stats.img).padStart(7)} ${kb(stats.font).padStart(7)} ${kb(total).padStart(8)}  ${String(stats.dcl + "ms").padStart(6)}  ${[...heavy].join(", ") || "-"}`,
  );

  await page.close();
}

console.log(
  "\nheavy libs should appear on / only — anywhere else means a lazy import leaked into the shared bundle.\n",
);

await browser.close();
