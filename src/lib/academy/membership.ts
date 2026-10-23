import "server-only";

import { embedUrl, lessonVideo } from "@/lib/academy/video";
import { getAuthContext } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

/**
 * A member's membership, delivered — note 07 §5–§12, §31; migration 0012.
 *
 * ACCESS IS READ FROM THE ENTITLEMENT (note 09 §16.1). `my_membership()`
 * returns the caller's live membership entitlement joined to its tier, and is
 * the same for a monthly subscriber and a member who paid for a year. The
 * subscription is consulted for one thing only: when, and whether, it renews.
 *
 * What a tier includes is data (`membership_tiers`): how many series and
 * playlists the member chooses, or all of them; whether the Q&A and the
 * retreat are included. Nothing here names a tier.
 */
export type Membership = {
  tier: string;
  tierName: string;
  rank: number;
  /** When access ends if nothing more is paid. */
  expiresAt: string | null;
  /** A subscription that will take its next payment. */
  renews: boolean;
  /** The next payment date, or the last day of access, as the member means it. */
  date: string | null;
  /** A failed renewal is being retried; access continues for now. */
  pastDue: boolean;
  /** Series the member may register for in each membership year; null for no limit. */
  seriesAllowance: number | null;
  /** Playlists the member chooses; null when every playlist is included. */
  playlistAllowance: number | null;
  includesQa: boolean;
  /** For THIS member: a tier may keep retreats for those paying by the year. */
  includesRetreats: boolean;
  /** Paying by the year (or a year paid at once), not by the month. */
  yearly: boolean;
};

type MembershipRow = {
  tier: string;
  tier_name: string;
  rank: number;
  source_type: string;
  expires_at: string | null;
  series_allowance: number | null;
  playlist_allowance: number | null;
  includes_qa: boolean;
  includes_retreats: boolean;
  yearly: boolean;
};

export async function myMembership(): Promise<Membership | null> {
  const userId = (await getAuthContext())?.userId;
  if (!userId) return null;
  const supabase = await createClient();

  const { data } = await supabase.rpc("my_membership");
  const row = (data as MembershipRow[] | null)?.[0];
  if (!row) return null;

  // Renewal is the subscription's to say. A lump-sum member has none, and
  // "does not renew" is then the true answer rather than a missing one.
  let renews = false;
  let pastDue = false;
  let date = row.expires_at;
  if (row.source_type === "membership") {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status,current_period_end,cancel_at")
      .eq("user_id", userId)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      renews = !sub.cancel_at;
      pastDue = sub.status === "past_due";
      // The entitlement runs a few days past the paid period (the grace a
      // failed payment is retried in); the date a member recognises is the
      // period's own.
      date = sub.cancel_at ?? sub.current_period_end ?? row.expires_at;
    }
  }

  return {
    tier: row.tier,
    tierName: row.tier_name.replace(/\s+Membership$/i, ""),
    rank: row.rank,
    expiresAt: row.expires_at,
    renews,
    date,
    pastDue,
    seriesAllowance: row.series_allowance,
    playlistAllowance: row.playlist_allowance,
    includesQa: row.includes_qa,
    includesRetreats: row.includes_retreats,
    yearly: row.yearly,
  };
}

export type ChoiceItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The member holds this one. */
  chosen: boolean;
};

export type ChoiceSet = {
  /** Null when the tier includes all of them: there is nothing to choose. */
  allowance: number | null;
  /** How many more the member may still choose. */
  remaining: number;
  items: ChoiceItem[];
};

export type MemberSeries = {
  /** Series the tier includes in each membership year. Null for no limit. */
  allowance: number | null;
  /** How many of them this member has taken this year. */
  used: number;
  /** The runs they are on now (through their membership or bought). */
  registered: Array<{ id: string; seriesName: string; label: string; startsAt: string; endsAt: string }>;
  /**
   * Runs they could register for now, with a place. A pass holder may register
   * ahead of everyone (migration 0026): `opensToAll` is when registration opens
   * to the public, while that is still to come, and null once it has.
   */
  open: Array<{
    id: string;
    seriesName: string;
    label: string;
    startsAt: string;
    endsAt: string;
    placesLeft: number;
    opensToAll: string | null;
  }>;
};

/**
 * What a member has, and may still take or choose — migration 0018.
 *
 *   series     taken by REGISTERING FOR A RUN, as a buyer does, up to the
 *              tier's number in each membership year. `open` lists the runs
 *              they could register for now; a series they are already on is
 *              left out, since a second run of it would be the same sessions.
 *   playlists  chosen once and kept.
 *
 * Playlists above the member's tier (the Miscellaneous playlist, for Silver)
 * are left out altogether rather than shown locked: this page is what the
 * member has, and the tiers page is where the comparison lives.
 */
export async function membershipChoices(
  membership: Membership,
): Promise<{ series: MemberSeries; playlists: ChoiceSet }> {
  const userId = (await getAuthContext())?.userId;
  const supabase = await createClient();
  const now = Date.now();
  const iso = new Date(now).toISOString();

  const [{ data: playlists }, { data: tiers }, { data: choices }, { data: allowance }, { data: mine }, { data: runs }] =
    await Promise.all([
      supabase.from("playlists").select("id,name,slug,description,min_tier").eq("status", "published").order("position").order("name"),
      supabase.from("membership_tiers").select("tier,rank"),
      userId
        ? supabase.from("membership_choices").select("kind,resource_id,created_at").eq("user_id", userId).order("created_at")
        : Promise.resolve({ data: [] }),
      supabase.rpc("my_series_allowance"),
      userId
        ? supabase
            .from("coaching_registrations")
            .select("coaching_runs(id,series_id,label,starts_at,ends_at,group_coaching_series(name))")
            .eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      supabase
        .from("coaching_runs")
        .select("id,series_id,label,starts_at,ends_at,registration_opens_at,group_coaching_series(name)")
        .eq("status", "published")
        // From the day pass holders can register, which is ahead of everyone.
        .lte("pass_opens_at", iso)
        .gt("registration_closes_at", iso)
        .order("starts_at"),
    ]);

  type RunRow = {
    id: string;
    series_id: string;
    label: string;
    starts_at: string;
    ends_at: string;
    registration_opens_at?: string;
    group_coaching_series: { name: string } | null;
  };

  const registered = ((mine ?? []) as unknown as Array<{ coaching_runs: RunRow | null }>)
    .map((m) => m.coaching_runs)
    .filter((r): r is RunRow => r !== null && +new Date(r.ends_at) > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const takenSeries = new Set(registered.map((r) => r.series_id));

  const candidates = ((runs ?? []) as unknown as RunRow[]).filter((r) => !takenSeries.has(r.series_id));
  const open = (
    await Promise.all(
      candidates.map(async (r) => {
        const { data: left } = await supabase.rpc("run_places_left", { p_run_id: r.id });
        return { ...r, placesLeft: typeof left === "number" ? left : 0 };
      }),
    )
  ).filter((r) => r.placesLeft > 0);

  const rankOf = new Map((tiers ?? []).map((t) => [t.tier as string, t.rank]));
  const visible = (playlists ?? []).filter((p) => (rankOf.get(p.min_tier) ?? 0) <= membership.rank);
  const chosen = (choices ?? []).filter((c) => c.kind === "playlist").map((c) => c.resource_id as string);
  const held = new Set(membership.playlistAllowance == null ? [] : chosen.slice(0, membership.playlistAllowance));

  const row = (allowance as Array<{ allowance: number | null; used: number }> | null)?.[0];
  const view = (r: RunRow) => ({
    id: r.id,
    seriesName: r.group_coaching_series?.name ?? "Group Coaching",
    label: r.label,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
  });

  return {
    series: {
      allowance: row?.allowance ?? membership.seriesAllowance,
      used: row?.used ?? 0,
      registered: registered.map(view),
      open: open.map((r) => ({
        ...view(r),
        placesLeft: r.placesLeft,
        opensToAll: r.registration_opens_at && +new Date(r.registration_opens_at) > now ? r.registration_opens_at : null,
      })),
    },
    playlists: {
      allowance: membership.playlistAllowance,
      remaining: membership.playlistAllowance == null ? 0 : Math.max(membership.playlistAllowance - held.size, 0),
      items: visible.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        chosen: membership.playlistAllowance == null || held.has(p.id),
      })),
    },
  };
}

export type PlaylistVideo = {
  id: string;
  title: string;
  description: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  /** Added in the last fortnight. */
  isNew: boolean;
};

export type PlaylistDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** The caller may watch it. False renders the page locked, not missing. */
  canView: boolean;
  videos: PlaylistVideo[];
  /** The video to play: the one asked for, else the newest. */
  playing: (PlaylistVideo & { url: string | null }) | null;
};

/**
 * A playlist and its videos, newest first.
 *
 * The playlist row is public (its name and description sell the membership);
 * the videos are not. RLS returns them only to a member whose entitlement and
 * tier cover the playlist (`can_view_playlist`), so a caller without access
 * gets the playlist and an empty list — locked, not missing.
 *
 * The listing never carries a video's address. One URL is built, for the video
 * being played, here on the server after the row has come back through RLS —
 * the rule lessons follow (lib/academy/video, note 07 §R29).
 */
export async function playlistBySlug(slug: string, videoId?: string): Promise<PlaylistDetail | null> {
  const supabase = await createClient();

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id,name,slug,description")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!playlist) return null;

  const [{ data: canView }, { data: rows }] = await Promise.all([
    supabase.rpc("can_view_playlist", { p_playlist_id: playlist.id }),
    supabase
      .from("playlist_videos")
      .select("id,title,description,video_duration_seconds,published_at,position")
      .eq("playlist_id", playlist.id)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("position"),
  ]);

  const now = Date.now();
  const videos: PlaylistVideo[] = (rows ?? []).map((v) => ({
    id: v.id,
    title: v.title,
    description: v.description,
    durationSeconds: v.video_duration_seconds,
    publishedAt: v.published_at,
    isNew: v.published_at ? now - +new Date(v.published_at) < 14 * 86_400_000 : false,
  }));

  const selected = videos.find((v) => v.id === videoId) ?? videos[0] ?? null;
  let playing: PlaylistDetail["playing"] = null;
  if (selected) {
    const { data: source } = await supabase
      .from("playlist_videos")
      .select("video_provider,video_id,video_hash")
      .eq("id", selected.id)
      .maybeSingle();
    const video = source ? lessonVideo(source) : null;
    playing = { ...selected, url: video ? embedUrl(video) : null };
  }

  return {
    id: playlist.id,
    name: playlist.name,
    slug: playlist.slug,
    description: playlist.description,
    canView: canView === true,
    videos,
    playing,
  };
}
