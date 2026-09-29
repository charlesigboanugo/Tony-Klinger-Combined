import "server-only";

import { embedUrl, lessonVideo } from "@/lib/academy/video";
import { createPublicClient } from "@/lib/supabase/public";

/** A filmed testimonial, with its cover resolved and its player address built. */
export type TestimonialVideo = {
  id: string;
  slug: string;
  title: string | null;
  attributed_to: string | null;
  duration_seconds: number | null;
  cover_path: string | null;
  /** Null until the owner has uploaded it to the video host — shown as "Coming soon". */
  embed_url: string | null;
};

/**
 * Published filmed testimonials — migration 0015.
 *
 * Public marketing video, so the embed URL is built for every reader: the
 * entitlement gate that lesson video goes through (note 07 §R29) is about who
 * may watch, and here the answer is everyone. The URL is still composed from
 * a provider and an id by the one function that knows how, so moving host
 * stays a data change.
 */
export async function listTestimonialVideos(): Promise<TestimonialVideo[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("testimonial_videos")
    .select("id,slug,title,attributed_to,duration_seconds,video_provider,video_id,video_hash,resources(storage_path)")
    .eq("status", "published")
    .order("position", { ascending: true });

  return (data ?? []).map((row) => {
    const cover = Array.isArray(row.resources) ? row.resources[0] : row.resources;
    const video = lessonVideo(row);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      attributed_to: row.attributed_to,
      duration_seconds: row.duration_seconds,
      cover_path: cover?.storage_path ?? null,
      embed_url: video ? embedUrl(video) : null,
    };
  });
}
