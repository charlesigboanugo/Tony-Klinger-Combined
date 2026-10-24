// The email layout — heading, body, footer — in ONE place (owner, 2026-10-24).
//
// Plain JavaScript, no imports, so both the site (src/lib/email/templates.ts)
// and `pnpm brevo:templates` (scripts/brevo-templates.mjs) use the same one:
//
//   site     layout(title, bodyHtml, siteUrl)  → the email it sends itself
//   Brevo    layout("{{ params.title }}", "{{ params.body | safe }}",
//                   "{{ params.site_url }}")   → the template in the dashboard
//
// So a Brevo template is this layout with the wording passed in as params: the
// wording stays in the site's code and cannot drift from it, while the look can
// be restyled in Brevo. `| safe` inserts the body as HTML; the site escapes
// everything a visitor typed before it gets there (checked against Brevo,
// 2026-10-24: plain `{{ params.x }}` is escaped, `| safe` is not).

/**
 * @param {string} title
 * @param {string} body
 * @param {string} siteUrl
 */
export function layout(title, body, siteUrl) {
  return `
<!doctype html>
<html><body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;line-height:1.6;color:#1E1B2E;max-width:560px;margin:0 auto;padding:24px">
<h1 style="font-size:20px;margin:0 0 16px">${title}</h1>
${body}
<hr style="border:none;border-top:1px solid #DCD8E6;margin:32px 0 16px">
<p style="font-size:12px;color:#56506B;margin:0">Tony Klinger · <a href="${siteUrl}" style="color:#56506B">tonyklinger.com</a></p>
</body></html>`.trim();
}

/** The Brevo template for every site email: this layout, filled by params. */
export const BREVO_TEMPLATE = {
  subject: "{{ params.subject }}",
  html: layout("{{ params.title }}", "{{ params.body | safe }}", "{{ params.site_url }}"),
};
