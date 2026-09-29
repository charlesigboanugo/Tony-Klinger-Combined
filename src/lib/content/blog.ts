import "server-only";

import { cache } from "react";

import { createPublicClient } from "@/lib/supabase/public";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  published_at: string | null;
  word_count: number;
};

const FIELDS = "id,title,slug,excerpt,content,published_at,word_count";

/**
 * Columns for a LISTING. Deliberately without `content`.
 *
 * The archive holds 172 posts averaging ~4,700 characters, so selecting
 * `content` to render an index cost roughly 800KB of article bodies over the
 * wire to display excerpts — none of it ever reaching the page. The index only
 * ever needs a title, a date, an excerpt and — for reading time — the stored
 * `word_count` (migration 0013), which is why that is a column and not
 * something counted here.
 */
const LIST_FIELDS = "id,title,slug,excerpt,published_at,word_count";

/** A post as it appears in a listing — no body. */
export type BlogPostSummary = Omit<BlogPost, "content">;

/** A neighbour in the reading order — just enough to link to it. */
export type BlogPostLink = Pick<BlogPost, "title" | "slug" | "published_at">;

/**
 * Minutes to read, at 230 words a minute — a common adult silent-reading
 * pace for prose. Never less than one: "0 min read" is not a thing a person
 * would say.
 */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}

export const SITE_AUTHOR = "Tony Klinger";

/**
 * Who wrote a post. Nearly every essay is Tony's, but the archive carries the
 * occasional guest piece, and `author_user_id` is empty for every imported
 * row. A guest piece closes with a "Written by …" line — that is the only
 * record of its author, so it is read from there rather than the page
 * claiming Tony wrote someone else's words.
 */
export function postAuthor(content: string | null): string {
  const last = content?.trimEnd().split("\n").at(-1)?.trim() ?? "";
  const match = /^written by\s+(.{2,80})$/i.exec(last);
  return match ? match[1].replace(/[.\s]+$/, "") : SITE_AUTHOR;
}

/**
 * Published posts, newest first — note 08 §28.1.
 *
 * A draft is unreachable even by guessing its slug: RLS filters on status and
 * publication date, not merely on whether we rendered a link.
 */
export async function listPosts(limit?: number): Promise<BlogPostSummary[]> {
  const supabase = createPublicClient();
  let query = supabase
    .from("blog_posts")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  if (limit) query = query.limit(limit);

  const { data } = await query;
  return (data as BlogPostSummary[] | null) ?? [];
}

/**
 * One page of the archive.
 *
 * The archive is 172 posts and grows. Rendering all of them puts ~172 cards in
 * the DOM for a visitor who will read one, which is a cost paid on every visit
 * for no benefit. `range` is applied in Postgres, so the rows never leave the
 * database.
 */
export async function listPostsPage(
  page: number,
  perPage: number,
): Promise<BlogPostSummary[]> {
  const supabase = createPublicClient();
  const from = (page - 1) * perPage;

  const { data } = await supabase
    .from("blog_posts")
    .select(LIST_FIELDS)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + perPage - 1);

  return (data as BlogPostSummary[] | null) ?? [];
}

/** How many published posts exist, without fetching any of them. */
export async function countPosts(): Promise<number> {
  const supabase = createPublicClient();
  const { count } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

/**
 * One post by slug. Cached per request, because the page and its
 * `generateMetadata` both ask for it and would otherwise query twice.
 */
export const getPost = cache(async (slug: string): Promise<BlogPost | null> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(FIELDS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  return (data as BlogPost | null) ?? null;
});

/**
 * The posts either side of one in publication order, for the foot of an
 * article — a reader who finishes one essay is offered the next rather than
 * sent back to the index.
 *
 * Two single-row queries on the `published_at` index rather than fetching the
 * archive and finding the position in it.
 */
export async function getAdjacentPosts(
  publishedAt: string,
): Promise<{ older: BlogPostLink | null; newer: BlogPostLink | null }> {
  const supabase = createPublicClient();
  const fields = "title,slug,published_at";

  const [older, newer] = await Promise.all([
    supabase
      .from("blog_posts")
      .select(fields)
      .eq("status", "published")
      .lt("published_at", publishedAt)
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("blog_posts")
      .select(fields)
      .eq("status", "published")
      .gt("published_at", publishedAt)
      .order("published_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    older: (older.data as BlogPostLink | null) ?? null,
    newer: (newer.data as BlogPostLink | null) ?? null,
  };
}
