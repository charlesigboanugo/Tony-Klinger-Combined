/**
 * The visitor's browser and address, forwarded to Supabase Auth — migration 0022.
 *
 * Sign-in, token refresh and every other Auth call from this app are made BY
 * THE SERVER, so Supabase recorded each session's device as "node" and its
 * address as the server's own. Passing the visitor's User-Agent and client IP
 * through lets "Signed-in devices" say "Safari on iPhone" instead of "Unknown
 * device". Informational only: nothing is authorised on either value.
 */
export function visitorHeaders(incoming: Headers): Record<string, string> {
  const headers: Record<string, string> = {};
  const ua = incoming.get("user-agent");
  if (ua) {
    /*
      Chrome and Edge send the device model and real platform version only as
      User-Agent Client Hints (requested by proxy.ts). Supabase stores just the
      user agent, so the hints ride along on it as two extra tokens, which
      `describeDevice()` reads back.
    */
    const hint = (name: string) => incoming.get(name)?.replace(/^"|"$/g, "").trim();
    const model = hint("sec-ch-ua-model");
    const version = hint("sec-ch-ua-platform-version");
    headers["user-agent"] = [
      ua,
      model ? `TKModel/${encodeURIComponent(model)}` : "",
      version ? `TKPlatformVersion/${encodeURIComponent(version)}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  const ip =
    incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip")?.trim();
  if (ip) headers["x-forwarded-for"] = ip;
  return headers;
}
