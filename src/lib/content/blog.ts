import "server-only";

import { createClient } from "@/lib/supabase/server";

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  published_at: string | null;
};

const FIELDS = "id,title,slug,excerpt,content,published_at";

/**
 * Columns for a LISTING. Deliberately without `content`.
 *
 * The archive holds 172 posts averaging ~4,700 characters, so selecting
 * `content` to render an index cost roughly 800KB of article bodies over the
 * wire to display excerpts — none of it ever reaching the page. The index only
 * ever needs a title, a date and an excerpt.
 */
const LIST_FIELDS = "id,title,slug,excerpt,published_at";

/** A post as it appears in a listing — no body. */
export type BlogPostSummary = Omit<BlogPost, "content">;

/**
 * Published posts, newest first — note 08 §28.1.
 *
 * A draft is unreachable even by guessing its slug: RLS filters on status and
 * publication date, not merely on whether we rendered a link.
 */
export async function listPosts(limit?: number): Promise<BlogPostSummary[]> {
  const supabase = await createClient();
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
  const supabase = await createClient();
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
  const supabase = await createClient();
  const { count } = await supabase
    .from("blog_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select(FIELDS)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  return (data as BlogPost | null) ?? null;
}
