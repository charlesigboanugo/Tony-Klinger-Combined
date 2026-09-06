/**
 * Every button, on every route, in both themes — note 10 §21, §26.
 *
 * `audit-contrast-live.mjs` walks text runs on PUBLIC routes while signed out.
 * That left three blind spots, and the workspaces were built after it:
 *
 *   - Admin, Account and Academy were never visited at all
 *   - hover states were never entered, and several variants recolour on hover
 *   - disabled states were never reached
 *
 * This walks control elements specifically, composites the label colour over
 * whatever is actually painted behind it, and forces :hover through CDP so the
 * hover palette is measured rather than assumed.
 *
 * IT SAMPLES TWICE, a second apart, and reports only what fails BOTH times.
 * Buttons transition their colours, and a control coming out of its disabled
 * state passes through every intermediate shade on the way — the first version
 * of this script duly reported three "failures" at 2.70, 4.27 and 4.29 for one
 * button that settles at 6.06. A contrast auditor that reports mid-animation
 * frames trains you to ignore it.
 *
 *   LD_LIBRARY_PATH=$HOME/.local/lib/browser-deps node scripts/audit-buttons.mjs
 *   … --dark        only the dark theme
 *   … --route=/x    only one route
 *   … --mobile      390px instead of 1440px, which is where the mobile sheet,
 *                   the sticky CTAs and any stacked control only then exist
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASS = "password123";
const only = process.argv.find((a) => a.startsWith("--route="))?.slice(8);
const mobile = process.argv.includes("--mobile");
const VIEWPORT = mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 };

const PUBLIC_ROUTES = [
  "/", "/about", "/about/team", "/blog", "/catalogue", "/catalogue/books",
  "/coaching", "/coaching/memberships", "/coaching/memberships/gold",
  "/coaching/courses", "/coaching/cohorts", "/coaching/group-coaching",
  "/coaching/private-coaching", "/coaching/retreats", "/give-get-go",
  "/events", "/contact", "/cart", "/checkout", "/privacy",
  "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password",
  // Detail pages, where a template renders content it does not control.
  "/catalogue/films", "/catalogue/audio", "/coaching/courses/level-one",
  "/coaching/group-coaching", "/about/testimonials", "/coaching/about",
  "/give-get-go/publishing", "/give-get-go/films", "/terms", "/accessibility",
  "/this-route-does-not-exist",
];

// Signed in as a customer with entitlements.
const CUSTOMER_ROUTES = [
  "/account", "/account/profile", "/account/orders", "/account/security",
  "/account/security/mfa", "/account/billing", "/account/settings",
  "/account/notifications", "/account/entitlements", "/account/bookings",
  "/academy", "/academy/courses", "/academy/courses/level-one",
  "/academy/courses/level-one/lessons/education-training",
  "/academy/cohorts", "/academy/coaching",
  "/checkout/success", "/bookings", "/welcome",
];

// Signed in as the owner, second factor presented.
const STAFF_ROUTES = [
  "/admin", "/admin/users", "/admin/roles", "/admin/orders", "/admin/payments",
  "/admin/entitlements", "/admin/products", "/admin/prices", "/admin/courses",
  "/admin/modules", "/admin/lessons", "/admin/blog", "/admin/catalogue",
  "/admin/team", "/admin/media", "/admin/emails", "/admin/settings",
  "/admin/lessons/new", "/admin/bookings", "/admin/products/new",
  "/admin/blog/new", "/admin/team/new", "/admin/testimonials",
  "/admin/group-coaching", "/admin/cohorts", "/admin/masterclasses",
  "/admin/retreats", "/admin/events", "/admin/private-coaching",
  "/admin/memberships", "/admin/audit",
];

/**
 * Buttons that reveal more buttons.
 *
 * Several controls are disclosures — the invite form, the key reset, the media
 * picker — so the thing most likely to be mis-styled is the thing a route visit
 * never renders. Matched by accessible name and clicked before measuring; each
 * one only opens a panel, so nothing here commits a change.
 */
const DISCLOSURES = [
  /^Invite someone$/i,
  /^Clear security keys$/i,
  /^Add another key$/i,
  /^Search the media library$/i,
  /^Choose an image$/i,
  /^Menu$/i,
];

/** Runs in the page. Every control, resting; hover is forced from outside. */
function collect() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };

  /** What is actually painted behind this element. */
  const painted = (el) => {
    let node = el;
    let acc = null;
    while (node) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) acc = acc ? over(acc, bg) : bg;
      if (acc && acc.a >= 1) return acc;
      node = node.parentElement;
    }
    const page = parse(getComputedStyle(document.body).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
    return acc ? over(acc, page) : page;
  };

  // Controls, plus the pills and badges that carry state — a status chip whose
  // label cannot be read is exactly as broken as an unreadable button.
  const controls = [
    ...document.querySelectorAll(
      'button, [role="button"], [role="tab"], [role="radio"], input[type="submit"], ' +
      'a[class*="rounded-full"], a[class*="rounded-("], ' +
      'span[class*="rounded-full"], li[class*="rounded-full"], [class*="badge"], [class*="Pill"]',
    ),
  ];

  const out = [];
  for (const el of controls) {
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) continue;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.opacity === "0") continue;

    const label = (el.innerText || el.value || "").trim().replace(/\s+/g, " ");
    if (!label) continue;

    const fg = parse(style.color);
    if (!fg) continue;

    const bg = painted(el);
    const colour = fg.a < 1 ? over(fg, bg) : fg;

    const px = parseFloat(style.fontSize);
    const bold = parseInt(style.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);

    out.push({
      label: label.slice(0, 48),
      ratio: +ratio(colour, bg).toFixed(2),
      threshold: large ? 3 : 4.5,
      disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true",
      colour: `rgb(${[colour.r, colour.g, colour.b].map(Math.round).join(",")})`,
      bg: `rgb(${[bg.r, bg.g, bg.b].map(Math.round).join(",")})`,
    });
  }
  return out;
}

const browser = await chromium.launch({ headless: true });

async function sessionFor(kind) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: "light",
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  if (kind === "public") return { context, page };

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
  const only1 = async (which) => {
    for (const [n, id] of Object.entries(ids)) {
      await cdp.send("WebAuthn.setAutomaticPresenceSimulation", { authenticatorId: id, enabled: n === which });
    }
  };

  const email = kind === "staff" ? "owner@test.local" : "gold@test.local";
  await page.goto(`${BASE}/auth/sign-in`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASS);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/auth/sign-in"), { timeout: 25000 }),
    page.getByRole("button", { name: "Sign in", exact: true }).click(),
  ]);

  if (kind === "staff") {
    for (const [t, label] of [["internal", "Audit primary"], ["usb", "Audit spare"]]) {
      await only1(t);
      await page.goto(`${BASE}/account/security/mfa`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector('input[placeholder="Laptop"]', { timeout: 60000 });
      await page.fill('input[placeholder="Laptop"]', label);
      await page.getByRole("button", { name: /Register a security key/i }).click();
      await page.waitForTimeout(4500);
    }
    await only1("internal");
  }
  return { context, page };
}

const failures = [];
const coverage = [];
const unreachable = [];
let checked = 0;

for (const dark of [false, true]) {
  for (const [kind, routes] of [
    ["public", PUBLIC_ROUTES],
    ["customer", CUSTOMER_ROUTES],
    ["staff", STAFF_ROUTES],
  ]) {
    const list = only ? routes.filter((r) => r === only) : routes;
    if (list.length === 0) continue;

    const { context, page } = await sessionFor(kind);
    await context.addInitScript((isDark) => {
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    }, dark);
    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");

    for (const route of list) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 75000 });
        await page.evaluate((isDark) => {
          document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
        }, dark);
        await page.waitForTimeout(700);

        // Open anything that hides controls behind a click.
        for (const pattern of DISCLOSURES) {
          const control = page.getByRole("button", { name: pattern });
          if ((await control.count()) > 0) {
            await control.first().click({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(400);
          }
        }

        const landed = new URL(page.url()).pathname;

        for (const state of ["rest", "hover"]) {
          if (state === "hover") {
            // Force :hover on every control at once, so hover palettes are
            // measured rather than assumed.
            const { root } = await cdp.send("DOM.getDocument");
            const { nodeIds } = await cdp.send("DOM.querySelectorAll", {
              nodeId: root.nodeId,
              selector: 'button, [role="button"], a[class*="rounded-full"], a[class*="rounded-("]',
            });
            for (const nodeId of nodeIds) {
              await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["hover"] })
                .catch(() => {});
            }
            await page.waitForTimeout(250);
          }

          // Two samples, a second apart. Anything failing only once was caught
          // mid-transition and is not a real defect.
          const first = await page.evaluate(collect);
          await page.waitForTimeout(1100);
          const second = await page.evaluate(collect);

          const settled = new Map();
          for (const item of second) {
            settled.set(`${item.label}|${item.colour}|${item.bg}`, item);
          }

          for (const item of first) {
            checked += 1;
            // WCAG exempts a disabled control; we still want it readable, so it
            // is reported at a lower bar rather than skipped.
            const bar = item.disabled ? 3 : item.threshold;
            if (item.ratio >= bar) continue;

            const still = settled.get(`${item.label}|${item.colour}|${item.bg}`);
            if (!still || still.ratio >= bar) continue;

            failures.push({
              theme: dark ? "dark" : "light",
              route: landed,
              state,
              ...still,
              bar,
            });
          }

          if (state === "rest") coverage.push(`${dark ? "d" : "l"} ${landed} ${first.length}`);
        }
      } catch (error) {
        unreachable.push(`${route}: ${String(error).split("\n")[0].slice(0, 90)}`);
      }
    }
    await context.close();
  }
}

await browser.close();

// One line per distinct problem, not per occurrence.
const seen = new Map();
for (const f of failures) {
  const key = `${f.theme}|${f.state}|${f.label}|${f.colour}|${f.bg}`;
  if (!seen.has(key)) seen.set(key, { ...f, routes: new Set() });
  seen.get(key).routes.add(f.route);
}

// A route that redirected elsewhere, or rendered nothing, was not audited —
// silence there is not the same as a pass.
const empty = coverage.filter((c) => c.endsWith(" 0"));
console.log(`\nchecked ${checked} control renderings across ${coverage.length} page loads`);
if (unreachable.length) console.log(`unreachable: ${unreachable.length}\n  ${unreachable.join("\n  ")}`);
if (empty.length) console.log(`no controls found on: ${empty.map((e) => e.split(" ")[1]).join(", ")}`);
if (seen.size === 0) {
  console.log("No button contrast failures.");
} else {
  console.log(`${seen.size} distinct failures:\n`);
  for (const f of [...seen.values()].sort((a, b) => a.ratio - b.ratio)) {
    console.log(
      `${f.ratio.toFixed(2)} (needs ${f.bar})  ${f.theme}/${f.state}  "${f.label}"\n` +
      `      ${f.colour} on ${f.bg}\n` +
      `      ${[...f.routes].slice(0, 4).join(", ")}${f.routes.size > 4 ? ` +${f.routes.size - 4}` : ""}`,
    );
  }
  process.exitCode = 1;
}
