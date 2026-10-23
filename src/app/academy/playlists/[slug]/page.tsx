import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountHeader } from "@/components/account/AccountHeader";
import { LessonVideo } from "@/components/academy/LessonVideo";
import { BackLink } from "@/components/ui/BackLink";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDuration } from "@/lib/academy/format";
import { playlistBySlug } from "@/lib/academy/membership";
import { academyStaffView } from "@/lib/academy/staff";
import { formatDate } from "@/lib/account/format";
import { requireUser } from "@/lib/permissions";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/academy/playlists/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const playlist = await playlistBySlug(slug);
  return { title: playlist?.name ?? "Playlist", robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A members' playlist — note 07 §5–§9, migration 0012.
 *
 * One video plays at the top; the rest of the playlist is listed beneath it,
 * newest first, each a link that plays it here (`?v=`). A list of links rather
 * than a wall of players: one iframe on the page, and the address of a video
 * is built only for the one being watched (lib/academy/membership).
 *
 * A member whose tier or choice does not cover this playlist sees it locked,
 * with the way to it, rather than a 404 — the playlist exists, and saying so
 * is more useful than pretending otherwise.
 */
export default async function PlaylistPage({
  params,
  searchParams,
}: PageProps<"/academy/playlists/[slug]">) {
  const { slug } = await params;
  await requireUser(`/academy/playlists/${slug}`);

  const { v } = await searchParams;
  const playlist = await playlistBySlug(slug, typeof v === "string" && UUID.test(v) ? v : undefined);
  if (!playlist) notFound();

  // Staff with the staff view (note 06 §23.2) may watch any playlist.
  if (!playlist.canView && !(await academyStaffView())) {
    return (
      <>
        <BackLink href="/academy/playlists">Playlists</BackLink>
        <AccountHeader title={playlist.name} description={playlist.description ?? undefined} />
        <EmptyState
          icon="play"
          title="This playlist is not part of your pass"
          description="Choose it as your playlist, or move to a tier that includes every playlist."
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <ButtonLink href="/academy/playlists">Your playlists</ButtonLink>
              <ButtonLink href="/coaching/passes" variant="outline">
                Compare the tiers
              </ButtonLink>
            </div>
          }
        />
      </>
    );
  }

  const { playing, videos } = playlist;

  return (
    <>
      <BackLink href="/academy/playlists">Playlists</BackLink>
      <AccountHeader title={playlist.name} description={playlist.description ?? undefined} />

      {videos.length === 0 ? (
        <EmptyState
          icon="play"
          title="No videos here yet"
          description="Videos appear in this playlist as they are added. Nothing more to do: it is already yours."
        />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8">
          <div className="min-w-0">
            {playing?.url ? (
              <LessonVideo url={playing.url} title={playing.title} durationSeconds={playing.durationSeconds} />
            ) : (
              <p className="rounded-(--radius-lg) border border-dashed border-border p-6 text-sm text-muted-foreground">
                This video is being prepared and will be here shortly.
              </p>
            )}
            {playing ? (
              <div className="mt-5">
                <h2 className="text-xl">{playing.title}</h2>
                {playing.publishedAt ? (
                  <p className="mt-1 text-sm text-muted-foreground">Added {formatDate(playing.publishedAt)}</p>
                ) : null}
                {playing.description ? (
                  <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">{playing.description}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav aria-label={`Videos in ${playlist.name}`}>
            <h2 className="mb-3 text-base font-semibold">In this playlist</h2>
            <ul className="divide-y divide-border overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
              {videos.map((video) => {
                const current = video.id === playing?.id;
                return (
                  <li key={video.id}>
                    <Link
                      href={`/academy/playlists/${playlist.slug}?v=${video.id}`}
                      aria-current={current ? "true" : undefined}
                      className={cn(
                        "block border-l-2 px-4 py-3 text-sm transition-colors",
                        current
                          ? "border-accent bg-accent/10"
                          : "border-transparent hover:bg-surface-muted",
                      )}
                    >
                      <span className={cn("block font-medium", current && "text-accent")}>{video.title}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        {video.durationSeconds ? <span>{formatDuration(video.durationSeconds)}</span> : null}
                        {video.isNew ? (
                          <span className="rounded-full bg-accent/12 px-2 py-0.5 font-semibold text-accent">New</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
