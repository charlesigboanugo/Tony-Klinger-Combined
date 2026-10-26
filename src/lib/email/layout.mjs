// The email layout — masthead, card, footer — in ONE place (owner, 2026-10-24).
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
//
// THE SITE'S LOOK, BUILT FOR EMAIL APPS (owner, 2026-10-26: "build it well").
// The masthead is the site's — TK disc, "Tony Klinger" in the display serif,
// the tracked tagline — over a white card on the site's warm ground, with the
// oxblood strip the workspaces wear. Email apps are not browsers: layout is
// tables, every style is inline, widths are fixed with a fluid fallback, and
// the fonts (Fraunces, Poppins) load where the app allows it and fall back to
// Georgia and Helvetica/Arial where it does not (Gmail, Outlook). Light only:
// `color-scheme` stops apps inverting the colours into something unreadable.

/** The palette, from globals.css. Exported for the templates' helpers. */
export const EMAIL = {
  ground: "#f6f4ef",
  card: "#ffffff",
  line: "#e6e0d5",
  ink: "#16182b",
  muted: "#51556d",
  red: "#a3162f",
  serif: "Fraunces, Georgia, 'Times New Roman', serif",
  sans: "Poppins, 'Helvetica Neue', Helvetica, Arial, sans-serif",
};

/**
 * @param {string} title
 * @param {string} body
 * @param {string} siteUrl  the site's address, ending in "/"
 */
export function layout(title, body, siteUrl) {
  const e = EMAIL;
  return `
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  a { color: ${e.red}; }
  @media (max-width: 620px) {
    .tk-pad { padding-left: 22px !important; padding-right: 22px !important; }
    .tk-title { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${e.ground};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${e.ground}">
<tr><td align="center" style="padding:28px 12px 36px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px">

    <tr><td style="padding:0 4px 18px">
      <a href="${siteUrl}" style="text-decoration:none;color:${e.ink}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="38" height="38" align="center" valign="middle" style="width:38px;height:38px;border:1.5px solid ${e.ink};border-radius:50%;font-family:${e.serif};font-style:italic;font-weight:600;font-size:15px;color:${e.ink};line-height:38px">TK</td>
        <td style="padding-left:12px">
          <div style="font-family:${e.serif};font-weight:600;font-size:21px;line-height:1.1;color:${e.ink}">Tony Klinger</div>
          <div style="font-family:${e.sans};font-size:9.5px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;color:${e.muted};padding-top:3px">Producer · Author · Coach</div>
        </td>
      </tr></table>
      </a>
    </td></tr>

    <tr><td style="background:${e.card};border:1px solid ${e.line};border-top:4px solid ${e.red};border-radius:12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="tk-pad" style="padding:34px 40px 36px;font-family:${e.sans};font-size:15px;line-height:1.65;color:${e.ink}">
          <h1 class="tk-title" style="margin:0 0 18px;font-family:${e.serif};font-weight:600;font-size:28px;line-height:1.15;letter-spacing:-0.3px;color:${e.ink}">${title}</h1>
          ${body}
        </td>
      </tr></table>
    </td></tr>

    <tr><td class="tk-pad" style="padding:22px 40px 0;font-family:${e.sans};font-size:12px;line-height:1.6;color:${e.muted};text-align:center">
      <a href="${siteUrl}" style="color:${e.muted};text-decoration:none;font-weight:600">tonyklinger.com</a>
      &nbsp;·&nbsp; <a href="${siteUrl}contact" style="color:${e.muted}">Contact us</a>
      &nbsp;·&nbsp; <a href="${siteUrl}account" style="color:${e.muted}">Your account</a>
      <div style="padding-top:8px">Films, books and coaching from Tony Klinger.</div>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`.trim();
}

/** The Brevo template for every site email: this layout, filled by params. */
export const BREVO_TEMPLATE = {
  subject: "{{ params.subject }}",
  html: layout("{{ params.title }}", "{{ params.body | safe }}", "{{ params.site_url }}"),
};
