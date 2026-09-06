import "server-only";

/**
 * Lesson video — note 07 §R29, note 05 §11.
 *
 * THE PLAYABLE URL IS BUILT HERE AND NOWHERE ELSE, and this module is
 * `server-only` so it cannot be reached from a client component. That is the
 * whole point of storing a provider and an id rather than a URL: the address
 * comes into existence only inside a server render that has already checked
 * entitlement, so there is no stored value for a forgotten `select *` to leak.
 *
 * The gating argument (note 05): a host's domain lock stops OTHER sites
 * embedding our video and does nothing about who on our own site may watch it —
 * as far as the host is concerned every embed on tonyklinger.com is equally
 * legitimate, whether the viewer paid for Silver or Platinum. Only withholding
 * the URL distinguishes our own members from each other.
 *
 * HOW FAR THAT PROTECTION REACHES DEPENDS ON THE HOST, and the difference is
 * worth stating rather than discovering (R29):
 *
 *   vimeo, livid   can be restricted to our domains, so a URL copied out of an
 *                  entitled member's page is worth little anywhere else.
 *   youtube        cannot. An unlisted URL IS the credential, it never expires,
 *                  and revoking it means deleting and re-uploading the video.
 *
 * YouTube is where the existing course videos already live and is interim.
 * Withholding still does the work of keeping non-members out of the page; it
 * simply cannot survive a member who chooses to pass the address on.
 */

export type VideoProvider = "vimeo" | "livid" | "youtube";

export type LessonVideo = {
  provider: VideoProvider;
  id: string;
  hash: string | null;
};

/** Narrow a database row to a playable video, or null when there is none. */
export function lessonVideo(row: {
  video_provider: string | null;
  video_id: string | null;
  video_hash: string | null;
}): LessonVideo | null {
  if (!row.video_provider || !row.video_id) return null;
  /*
    A malformed id must degrade to "no video", never to a dead player.

    The migrated curriculum proved why: one row arrived from the source CMS
    carrying the literal string `IDHERE` where an id should be. Built into an
    embed URL that renders a black rectangle that never loads — which reads as
    our bug, on a page somebody paid to reach, rather than as the missing
    upload it actually is.

    Only formats we can state confidently are checked. A YouTube id is exactly
    eleven characters of [A-Za-z0-9_-]; a Vimeo id is numeric. Livid's is not
    documented here, so it is not guessed at.
  */
  const SHAPE: Record<string, RegExp> = {
    youtube: /^[A-Za-z0-9_-]{11}$/,
    vimeo: /^\d+$/,
  };

  const known: readonly string[] = ["vimeo", "livid", "youtube"];
  if (!known.includes(row.video_provider)) {
    // A provider we cannot build a URL for. Rendering nothing is right: an
    // invented URL would fail in the browser with no explanation.
    return null;
  }
  const shape = SHAPE[row.video_provider];
  if (shape && !shape.test(row.video_id)) return null;

  return {
    provider: row.video_provider as VideoProvider,
    id: row.video_id,
    hash: row.video_hash,
  };
}

/**
 * The embed URL. Call only after entitlement has been established.
 *
 * Vimeo's `h` parameter is the unlisted-link token; without it the player
 * refuses an unlisted video, which is the privacy setting these should use —
 * "unlisted plus domain lock" keeps the video out of Vimeo's own search and off
 * other people's sites.
 */
export function embedUrl(video: LessonVideo): string {
  if (video.provider === "vimeo") {
    const params = new URLSearchParams({
      // Chrome's autoplay rules would block it anyway, and a lesson that starts
      // talking before the reader is ready is hostile.
      autoplay: "0",
      dnt: "1",
      title: "0",
      byline: "0",
      portrait: "0",
    });
    if (video.hash) params.set("h", video.hash);
    return `https://player.vimeo.com/video/${encodeURIComponent(video.id)}?${params}`;
  }

  if (video.provider === "youtube") {
    const params = new URLSearchParams({
      // nocookie is not privacy theatre here: the standard player sets tracking
      // cookies for a third party on a page the customer paid to reach.
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}?${params}`;
  }

  // Livid. Kept deliberately simple until the account exists: the point of the
  // (provider, id) shape is that this is the only line that has to change.
  return `https://embed.livid.tv/${encodeURIComponent(video.id)}`;
}

/**
 * Pull the id out of a pasted URL, so an operator can paste what they have.
 *
 * The CMS these videos come from stores whole URLs, and asking somebody to
 * extract an id by hand from 41 of them is asking for 41 chances to get it
 * wrong. A bare id is returned unchanged, so pasting either works.
 */
export function videoIdFromInput(input: string): string {
  const value = input.trim();
  if (!value) return value;
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return url.pathname.slice(1);
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      return url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop() ?? value;
    }
    if (host.endsWith("vimeo.com")) {
      // https://vimeo.com/123456789/abcdef -> id 123456789, hash abcdef, and
      // the hash is entered separately rather than guessed at from the path.
      return url.pathname.split("/").filter(Boolean)[0] ?? value;
    }

    return url.pathname.split("/").filter(Boolean).pop() ?? value;
  } catch {
    return value;
  }
}

/** Origins the player needs, for the frame-src allowance in the proxy CSP. */
export const VIDEO_FRAME_ORIGINS = [
  "https://player.vimeo.com",
  "https://embed.livid.tv",
  "https://www.youtube-nocookie.com",
] as const;
