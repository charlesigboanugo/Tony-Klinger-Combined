#!/usr/bin/env node
/**
 * Contrast validation for the design tokens — note 10 §35 and §39.
 *
 * Light mode ships alongside dark (R24), which means a palette that passes in
 * one theme and fails in the other is NOT finished. This project has already
 * shipped that exact defect once: form-control borders sat at 1.30:1 against a
 * 3:1 requirement, and it was found by measuring rather than by looking.
 *
 * The token values are parsed out of globals.css rather than duplicated here,
 * so the check cannot drift away from what actually ships.
 *
 * Usage: node scripts/check-contrast.mjs
 * Exits non-zero if any pair fails, so it can gate a build.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "..", "src", "app", "globals.css"), "utf8");

/** Pull a `:root`-ish block's custom properties into a map. */
function block(startPattern) {
  const at = css.indexOf(startPattern);
  if (at === -1) throw new Error(`Could not find block: ${startPattern}`);
  const open = css.indexOf("{", at);
  // Walk braces so a nested block does not terminate us early.
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open, end);
  const out = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[m[1]] = m[2];
  }
  return out;
}

const light = block(":root {");
const dark = block(':root[data-theme="dark"] {');

function srgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex) {
  const [r, g, b] = srgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** [foreground token, background token, minimum, what it is] */
const PAIRS = [
  ["--foreground", "--background", 4.5, "body text on page"],
  ["--foreground", "--surface", 4.5, "body text on card"],
  ["--foreground", "--surface-muted", 4.5, "body text on muted panel"],
  ["--muted-foreground", "--background", 4.5, "secondary text on page"],
  ["--muted-foreground", "--surface", 4.5, "secondary text on card"],
  ["--muted-foreground", "--surface-muted", 4.5, "secondary text on muted panel"],
  ["--primary-foreground", "--primary", 4.5, "primary button label"],
  ["--button-foreground", "--button", 4.5, "filled CTA button label"],
  ["--secondary-foreground", "--secondary", 4.5, "secondary button label"],
  ["--accent-foreground", "--accent", 4.5, "accent button label"],
  ["--success-foreground", "--success", 4.5, "success label"],
  ["--warning-foreground", "--warning", 4.5, "warning label"],
  ["--error-foreground", "--error", 4.5, "error label"],
  // Non-text contrast, WCAG 1.4.11 — 3:1
  ["--input-border", "--background", 3, "input border on page"],
  ["--input-border", "--surface", 3, "input border on card"],
  ["--ring", "--background", 3, "focus ring on page"],
  ["--ring", "--surface", 3, "focus ring on card"],
  ["--primary", "--background", 3, "primary as UI mark on page"],
  ["--accent", "--background", 3, "accent as UI mark on page"],
  // Primary is also used as inline link text on plain background.
  ["--primary", "--background", 4.5, "primary as link text"],

  // The jewel blocks. These carry body copy at full size, so they are held to
  // the 4.5:1 text threshold rather than the 3:1 non-text one. They are
  // identical in both themes by design, so they are checked twice and should
  // report the same number — a divergence means one theme was edited alone.
  ["--block-foreground", "--block-oxblood", 4.5, "text on oxblood block"],
  ["--block-foreground", "--block-teal", 4.5, "text on teal block"],
  ["--block-foreground", "--block-indigo", 4.5, "text on indigo block"],

  // Solid button sitting ON a jewel field: light chip, dark label.
  ["--secondary", "--block-foreground", 4.5, "onBlock button label"],
];

let failures = 0;
for (const [themeName, tokens] of [
  ["light", light],
  ["dark", dark],
]) {
  console.log(`\n${themeName.toUpperCase()}`);
  for (const [fg, bg, min, label] of PAIRS) {
    const a = tokens[fg];
    const b = tokens[bg];
    if (!a || !b) {
      console.log(`  MISSING  ${fg} or ${bg} — incomplete token (note 10 §39)`);
      failures++;
      continue;
    }
    const r = ratio(a, b);
    const ok = r >= min;
    if (!ok) failures++;
    const mark = ok ? "pass" : "FAIL";
    console.log(
      `  ${mark}  ${r.toFixed(2).padStart(5)}:1  (min ${min})  ${label}  [${fg} on ${bg}]`,
    );
  }
}

console.log(
  failures === 0
    ? "\nAll contrast pairs pass in both themes.\n"
    : `\n${failures} contrast failure(s).\n`,
);
process.exit(failures === 0 ? 0 : 1);
