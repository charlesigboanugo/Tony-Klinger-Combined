import { permanentRedirect } from "next/navigation";

/**
 * The public team page was removed at the client's request (2026-09). The URL
 * redirects rather than 404s so existing links and search results still land
 * somewhere useful.
 */
export default function TeamPage() {
  permanentRedirect("/about");
}
