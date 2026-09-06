#!/usr/bin/env node
/**
 * RENDERED contrast audit — note 10 §35.
 *
 * `check-contrast.mjs` validates the TOKEN PAIRS. That is necessary and not
 * sufficient: it cannot see what a component actually renders. Half the text on
 * this site is drawn with an alpha modifier — `text-block-foreground/70`,
 * `text-white/55`, `text-muted-foreground` over a tinted panel — and none of
 * those combinations exist as a token pair, so none of them were being checked.
 *
 * This walks every visible text node in a real browser, composites the actual
 * colour against the actual background (following ancestors until it finds an
 * opaque one, exactly as the compositor does), and applies the WCAG threshold
 * for that text's size and weight.
 *
 * IT SIGNS IN. The first version walked public routes while signed out, which
 * meant Account, Academy and Admin — every page built after it — were never
 * measured at all. A clean report from an auditor that never opened half the
 * application is worse than no report.
 *
 * Usage:  node scripts/audit-contrast-live.mjs [--dark] [--public]
 * Exits non-zero on any failure, so it can gate a build.
 */

import { chromium } from "playwright";
import { homedir } from "node:os";
import { join } from "node:path";

process.env.LD_LIBRARY_PATH = `${join(homedir(), ".local", "lib", "browser-deps")}:${process.env.LD_LIBRARY_PATH ?? ""}`;

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const dark = process.argv.includes("--dark");
const publicOnly = process.argv.includes("--public");
const PASS = "password123";

const ROUTES = [
  "/",
  "/about",
  "/blog",
  "/catalogue",
  "/catalogue/books",
  "/catalogue/films",
  "/coaching",
  "/coaching/memberships",
  "/coaching/memberships/gold",
  "/coaching/courses",
  "/coaching/cohorts",
  "/coaching/group-coaching",
  "/coaching/private-coaching",
  "/coaching/retreats",
  "/give-get-go",
  "/events",
  "/contact",
  "/cart",
  "/checkout",
  "/auth/sign-in",
  "/auth/sign-up",
  "/privacy",
  "/catalogue/films",
  "/coaching/courses/level-one",
  "/about/testimonials",
  "/coaching/about",
  "/give-get-go/publishing",
  "/this-route-does-not-exist",
];

/** Signed in as a customer holding entitlements. */
const CUSTOMER_ROUTES = [
  "/account", "/account/profile", "/account/orders", "/account/security",
  "/account/security/mfa", "/account/billing", "/account/settings",
  "/account/notifications", "/account/entitlements", "/account/bookings",
  "/academy", "/academy/courses", "/academy/courses/level-one",
  "/academy/courses/level-one/lessons/education-training",
  "/academy/cohorts", "/welcome",
];

/** Signed in as the owner, second factor presented. */
const STAFF_ROUTES = [
  "/admin", "/admin/users", "/admin/roles", "/admin/orders", "/admin/payments",
  "/admin/entitlements", "/admin/products", "/admin/prices", "/admin/courses",
  "/admin/modules", "/admin/lessons", "/admin/lessons/new", "/admin/blog",
  "/admin/catalogue", "/admin/team", "/admin/media", "/admin/emails",
  "/admin/settings", "/admin/audit", "/admin/bookings", "/admin/testimonials",
];

/** Runs in the page. Returns every text run whose contrast falls short. */
function audit() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(",").map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };

  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });

  const lum = ({ r, g, b }) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };

  const ratio = (a, b) => {
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  /** Composite backgrounds up the tree until fully opaque. */
  function effectiveBg(el) {
    let stack = [];
    let node = el;
    while (node && node !== document.documentElement.parentElement) {
      const s = getComputedStyle(node);
      const c = parse(s.backgroundColor);
      // An element painting an image may put anything behind the text; treat it
      // as unknown rather than guessing, and skip those runs.
      if (s.backgroundImage && s.backgroundImage !== "none") return null;
      if (c && c.a > 0) {
        stack.push(c);
        if (c.a >= 0.999) break;
      }
      node = node.parentElement;
    }
    if (stack.length === 0) return { r: 255, g: 255, b: 255, a: 1 };
    let base = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i--) base = over(stack[i], base);
    return base;
  }

  const out = [];
  const seen = new Set();

  for (const el of document.querySelectorAll("body *")) {
    // Only elements with their OWN visible text.
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!own) continue;

    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    const s = getComputedStyle(el);
    if (s.visibility === "hidden" || s.display === "none") continue;
    if (parseFloat(s.opacity) < 0.1) continue;

    const fg = parse(s.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    if (!bg) continue;

    // The element's own opacity multiplies its text alpha.
    const elOpacity = parseFloat(s.opacity);
    const composited = over({ ...fg, a: fg.a * elOpacity }, bg);
    const contrast = ratio(composited, bg);

    const size = parseFloat(s.fontSize);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const min = large ? 3 : 4.5;

    if (contrast + 0.005 < min) {
      const key = `${el.tagName}|${own.slice(0, 40)}|${contrast.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        text: own.slice(0, 60),
        tag: el.tagName.toLowerCase(),
        cls: String(el.className).slice(0, 70),
        contrast: Number(contrast.toFixed(2)),
        min,
        size: Math.round(size),
        color: s.color,
      });
    }
  }
  return out;
}

const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

/**
 * A browser context for one audience.
 *
 * Staff need two keys and a presented factor to reach Admin at all (note 05
 * §11.1), so the session is built the way a real one is rather than faked.
 */
async function contextFor(kind) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: dark ? "dark" : "light",
  });
  const page = await context.newPage();
  if (kind === "public") return page;

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
      await cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
        authenticatorId: id,
        enabled: name === which,
      });
    }
  };

  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', kind === "staff" ? "owner@test.local" : "gold@test.local");
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);

  if (kind === "staff") {
    for (const [transport, label] of [["internal", "Audit primary"], ["usb", "Audit spare"]]) {
      await only(transport);
      await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 });
      await page.fill('input[placeholder="Laptop"]', label);
      await page.getByRole("button", { name: /Register a security key/i }).click();
      await page.waitForTimeout(4500);
    }
    await only("internal");
  }
  return page;
}

let total = 0;
let visited = 0;
console.log(`\nRENDERED CONTRAST AUDIT — ${dark ? "DARK" : "LIGHT"} theme\n`);

const AUDIENCES = publicOnly
  ? [["public", ROUTES]]
  : [["public", ROUTES], ["customer", CUSTOMER_ROUTES], ["staff", STAFF_ROUTES]];

for (const [kind, routes] of AUDIENCES) {
const page = await contextFor(kind);
for (const route of routes) {
  try {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 75000 });
    await page.waitForTimeout(900);
    // Bring reveal-on-scroll content in, or most of the page is never measured.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(250);

    visited += 1;
    const fails = await page.evaluate(audit);
    if (fails.length) {
      total += fails.length;
      console.log(`  ${route}`);
      for (const f of fails) {
        console.log(
          `     ${String(f.contrast).padStart(5)}:1 (need ${f.min})  ${f.size}px  "${f.text}"`,
        );
        console.log(`            ${f.tag}.${f.cls}`);
      }
    }
  } catch (e) {
    console.log(`  ${route}  ERROR ${e.message.split("\n")[0]}`);
  }
}
await page.context().close();
}

console.log(
  total === 0
    ? `\nNo contrast failures in ${visited} routes (${dark ? "dark" : "light"}).\n`
    : `\n${total} failing text run(s).\n`,
);

await browser.close();
process.exit(total === 0 ? 0 : 1);
