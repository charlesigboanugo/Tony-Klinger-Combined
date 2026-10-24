// Create or update the site's email templates in Brevo (owner, 2026-10-24).
//
//   pnpm brevo:templates                                   uses BREVO_API_KEY / BREVO_SENDER_EMAIL from .env.local
//   pnpm brevo:templates --write .env.remote.local         also writes the BREVO_TEMPLATE_… ids into that file
//   … --env <file>     read the key and sender from another file
//   … --dry-run        say what would change, change nothing
//
// One template per site email, all the shared layout (src/lib/email/layout.mjs)
// filled by params, so the wording stays in the site's code. Matched by name,
// so running it again updates in place and the ids never change. ONLY templates
// named "TK.com — …" are created or touched: the account also holds the old
// TKOC site's templates, which this never reads past their names.
import fs from "node:fs";

import { BREVO_TEMPLATE } from "../src/lib/email/layout.mjs";
import { readEnv } from "./lib/targets.mjs";

/** Site template → the name it has in Brevo, and the env variable for its id. */
const TEMPLATES = {
  welcome: "Welcome",
  order_receipt: "Order receipt",
  membership_activated: "Membership activated",
  guest_claim: "Guest claim",
  booking_confirmed: "Booking confirmed",
  booking_cancelled: "Booking cancelled",
  contact_enquiry: "Contact enquiry",
  event_ticket: "Event ticket",
  event_place_available: "Event place available",
  event_reminder: "Event reminder",
  event_starting: "Event starting soon",
  session_reminder: "Session reminder",
  session_starting: "Session starting soon",
  pass_ending: "Coaching Pass ending",
  private_coaching_rebook: "Private coaching rebook",
  security_key_removed: "Verification method removed",
  account_exists: "Account already exists",
  retreat_application_received: "Retreat application received (to staff)",
  retreat_application_sent: "Retreat application sent",
  retreat_application_approved: "Retreat application approved",
  retreat_application_closed: "Retreat application closed",
};
const PREFIX = "TK.com — ";

const argv = process.argv.slice(2);
const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const env = readEnv(flag("--env") ?? ".env.local");
const writeTo = flag("--write");
const dryRun = argv.includes("--dry-run");

if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) {
  console.error("Needs BREVO_API_KEY and BREVO_SENDER_EMAIL (a verified Brevo sender) in the env file.");
  process.exit(1);
}

const headers = { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" };
async function api(method, path, body) {
  const response = await fetch(`https://api.brevo.com/v3${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : {};
}

const existing = new Map();
for (let offset = 0; ; offset += 50) {
  const { templates = [], count = 0 } = await api("GET", `/smtp/templates?limit=50&offset=${offset}`);
  for (const t of templates) if (t.name.startsWith(PREFIX)) existing.set(t.name, t.id);
  if (offset + 50 >= count) break;
}

const sender = { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME || "Tony Klinger" };
const ids = {};
for (const [template, label] of Object.entries(TEMPLATES)) {
  const name = PREFIX + label;
  const content = { templateName: name, subject: BREVO_TEMPLATE.subject, htmlContent: BREVO_TEMPLATE.html, sender, isActive: true };
  const id = existing.get(name);
  if (dryRun) {
    console.log(`${id ? "update" : "create"}  ${name}${id ? ` (id ${id})` : ""}`);
    if (id) ids[template] = id;
    continue;
  }
  if (id) {
    await api("PUT", `/smtp/templates/${id}`, content);
    ids[template] = id;
    console.log(`updated  ${String(id).padStart(3)}  ${name}`);
  } else {
    const created = await api("POST", "/smtp/templates", content);
    ids[template] = created.id;
    console.log(`created  ${String(created.id).padStart(3)}  ${name}`);
  }
}

const lines = Object.entries(ids).map(([template, id]) => `BREVO_TEMPLATE_${template.toUpperCase()}=${id}`);
if (writeTo && !dryRun) {
  let file = fs.readFileSync(writeTo, "utf8");
  for (const line of lines) {
    const key = line.split("=")[0];
    const pattern = new RegExp(`^${key}=.*$`, "m");
    file = pattern.test(file) ? file.replace(pattern, line) : `${file.trimEnd()}\n${line}\n`;
  }
  fs.writeFileSync(writeTo, file);
  console.log(`\nWrote ${lines.length} template ids into ${writeTo}.`);
} else {
  console.log(`\n${lines.join("\n")}`);
}
