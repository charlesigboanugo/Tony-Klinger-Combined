// Supabase's own sign-in emails in the site's look (owner, 2026-10-26).
//
//   pnpm auth:templates --local                      write supabase/templates/*.html (local Supabase;
//                                                    restart it to pick them up)
//   pnpm auth:templates --env .env.remote.local      set them on that hosted project through the
//                                                    Management API
//   … --dry-run                                      say what would change, change nothing
//
// Supabase Auth sends these itself — confirm signup, magic link, reset password,
// staff invitation, and the password / email changed notices — so they are not
// in src/lib/email/templates.ts. They are built here from the same layout and
// pieces (src/lib/email/layout.mjs), so every email the site causes looks alike.
//
// THE LINKS ARE SUPABASE'S AND STAY AS THEY WERE. Confirm, magic link and reset
// use {{ .ConfirmationURL }}; the invitation uses token_hash (note 06 §14.2 —
// the default link put the session in the URL fragment, which no server sees).
// Only the design around them changes.
//
// The hosted API needs a Supabase access token: SUPABASE_ACCESS_TOKEN, or the
// one `supabase login` saved. It refuses a project that is not the one in the
// env file, and it never touches the production project unless pointed at it.
import fs from "node:fs";
import os from "node:os";

import { EMAIL, button, details, layout, note } from "../src/lib/email/layout.mjs";
import { readEnv } from "./lib/targets.mjs";

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const local = argv.includes("--local");
const envFile = flag("--env");
const dryRun = argv.includes("--dry-run");

if (local === !!envFile) {
  console.error("Say where: --local, or --env <file> for a hosted project.");
  process.exit(1);
}

/**
 * Every template, given the site's address as a Go template expression that
 * ends in "/". Supabase fills {{ .SiteURL }} and the rest when it sends.
 */
function templates(site) {
  const page = (title, body) => layout(title, body, site);
  return {
    confirmation: {
      subject: "Confirm your email address",
      html: page(
        "Confirm your email address",
        `<p style="margin-top:0">Follow the link below to confirm this email address and finish signing up.</p>
         ${button("{{ .ConfirmationURL }}", "Confirm email address")}
         ${note("If you didn't create an account with Tony Klinger, you can ignore this email.")}`,
      ),
    },
    magic_link: {
      subject: "Your sign-in link",
      html: page(
        "Your sign-in link",
        `<p style="margin-top:0">Follow the link below to sign in. This link expires shortly and can only be used once.</p>
         ${button("{{ .ConfirmationURL }}", "Sign in")}
         ${note("If you didn't ask to sign in, you can ignore this email.")}`,
      ),
    },
    recovery: {
      subject: "Reset your password",
      html: page(
        "Reset your password",
        `<p style="margin-top:0">We received a request to reset your password. Follow the link below to choose a new one.</p>
         ${button("{{ .ConfirmationURL }}", "Reset password")}
         ${note("If you didn't request this, you can safely ignore this email.")}`,
      ),
    },
    invite: {
      subject: "You've been invited to Tony Klinger",
      // token_hash, not ConfirmationURL — see the note at the top. `next`
      // takes the invitee to the password form, where a password is optional.
      html: page(
        "You've been invited",
        `<p style="margin-top:0">You have been invited to an account on Tony Klinger. Follow the link below to accept. You can choose a password, or sign in with an email link or Google instead.</p>
         ${button(`${site}auth/callback?token_hash={{ .TokenHash }}&type=invite&next=%2Fauth%2Freset-password%3Finvited%3D1`, "Accept the invitation")}
         ${note("If you were not expecting this, you can ignore this email.")}`,
      ),
    },
    password_changed_notification: {
      subject: "Your password was changed",
      html: page(
        "Your password was changed",
        `<p style="margin-top:0">The password for your account was recently changed.</p>
         <p>If you didn't make this change, reset your password and <a href="${site}contact" style="color:${EMAIL.red}">contact us</a> immediately.</p>
         ${button(`${site}auth/forgot-password`, "Reset your password")}`,
      ),
    },
    email_changed_notification: {
      subject: "Your email address was changed",
      html: page(
        "Your email address was changed",
        `<p style="margin-top:0">The email address for your account was changed.</p>
         ${details([
           ["From", "{{ .OldEmail }}"],
           ["To", "{{ .Email }}"],
         ])}
         <p>If you didn't make this change, contact us immediately.</p>
         ${button(`${site}contact`, "Contact us")}`,
      ),
    },
  };
}

if (local) {
  // Local Supabase's site_url has no trailing slash (supabase/config.toml).
  const all = templates("{{ .SiteURL }}/");
  const header = (name) =>
    `<!--\n  Supabase "${name}" email. GENERATED by \`pnpm auth:templates --local\` from\n  src/lib/email/layout.mjs — edit the script, not this file. Wired up in\n  supabase/config.toml; restart local Supabase to pick up a change.\n-->\n`;
  for (const [name, t] of Object.entries(all)) {
    const file = `supabase/templates/${name}.html`;
    if (dryRun) console.log(`write  ${file}`);
    else fs.writeFileSync(file, header(name) + t.html + "\n");
    if (!dryRun) console.log(`wrote  ${file}`);
  }
  process.exit(0);
}

const env = readEnv(envFile);
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const tokenFile = `${os.homedir()}/.supabase/access-token`;
const token = process.env.SUPABASE_ACCESS_TOKEN || (fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, "utf8").trim() : "");
if (!token) {
  console.error("Needs a Supabase access token: SUPABASE_ACCESS_TOKEN, or run `supabase login`.");
  process.exit(1);
}

const api = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
const headers = { Authorization: `Bearer ${token}`, "content-type": "application/json" };
const current = await (await fetch(api, { headers })).json();
if (!current.site_url) {
  console.error(`Could not read project ${ref}: ${JSON.stringify(current).slice(0, 200)}`);
  process.exit(1);
}

// {{ .SiteURL }} is exactly the project's site_url; make the base end in "/".
const site = current.site_url.endsWith("/") ? "{{ .SiteURL }}" : "{{ .SiteURL }}/";
const body = {};
for (const [name, t] of Object.entries(templates(site))) {
  body[`mailer_subjects_${name}`] = t.subject;
  body[`mailer_templates_${name}_content`] = t.html;
}

console.log(`project ${ref} (${current.site_url})`);
for (const name of Object.keys(templates(site))) {
  const changed = current[`mailer_templates_${name}_content`] !== body[`mailer_templates_${name}_content`];
  console.log(`${changed ? (dryRun ? "would set" : "set") : "unchanged"}  ${name}`);
}
if (dryRun) process.exit(0);

const response = await fetch(api, { method: "PATCH", headers, body: JSON.stringify(body) });
if (!response.ok) {
  console.error(`PATCH failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  process.exit(1);
}
console.log("done");
