import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Prose } from "@/components/content/Prose";
import { Container } from "@/components/layout/Container";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonLink } from "@/components/ui/Button";
import {
  getAdjacentPosts,
  getPost,
  postAuthor,
  readingMinutes,
  SITE_AUTHOR,
  type BlogPostLink,
} from "@/lib/content/blog";
import { absoluteUrl } from "@/lib/urls";
import { cn } from "@/lib/utils/cn";

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Not found" };
  const author = postAuthor(post.content);

  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    authors: [author === SITE_AUTHOR ? { name: author, url: absoluteUrl("/about") } : { name: author }],
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt ?? undefined,
      url: absoluteUrl(`/blog/${post.slug}`),
      authors: [author],
    },
  };
}

/**
 * One essay — note 03 §6, note 10 §42.
 *
 * A TITLE CARD, then a reading room, then the way on. The card is the noir
 * field with the title centred and rising into place, and the essay's own
 * generated cover laid across its lower edge — the same cover as its card on
 * the index, so the reader arrives somewhere they recognise. The reading room is one column set
 * for long reading (`Prose`), with a hairline progress bar across the top of
 * the viewport. The foot offers the neighbouring essays, so finishing one
 * leads to another rather than back out to a list.
 *
 * NO DATES, here or in the metadata (owner, 2026-09-25): the stored dates are
 * republication dates on the old site and misdate the writing. They still
 * order the essays, which is all they are used for.
 */
export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);

  // Covers both "no such post" and "draft" — RLS returns nothing for a draft,
  // so an unpublished slug is indistinguishable from a missing one.
  if (!post) notFound();

  const { older, newer } = post.published_at
    ? await getAdjacentPosts(post.published_at)
    : { older: null, newer: null };

  const minutes = readingMinutes(post.word_count);
  const author = postAuthor(post.content);
  const byTony = author === SITE_AUTHOR;

  // Structured data, so search engines can show the essay as an article with
  // its author and date. `<` is escaped so a title can never close the tag.
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt ?? undefined,
    wordCount: post.word_count,
    url: absoluteUrl(`/blog/${post.slug}`),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    author: byTony
      ? { "@type": "Person", name: author, url: absoluteUrl("/about") }
      : { "@type": "Person", name: author },
  }).replace(/</g, "\\u003c");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Reading progress — `.reading-progress` in globals.css. Above the
          sticky header (z-50), as thin as a rule, in the state colour. */}
      <div
        aria-hidden="true"
        className="reading-progress fixed inset-x-0 top-0 z-60 h-0.5 bg-accent"
      />

      {/* ------------------------------------------------ title card */}
      {/* Centred, not split (owner, 2026-09-25): back link, the title rising
          into place, the byline — then the essay's own cover as a ribbon
          laid across the edge of the dark field. */}
      <section className="grain relative isolate bg-block-noir text-block-foreground">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[10%] left-1/2 aspect-square w-[90vw] max-w-5xl -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--block-oxblood)_80%,transparent),transparent)] opacity-60 blur-3xl animate-[leak-drift_22s_ease-in-out_infinite_alternate] motion-reduce:animate-none" />
        </div>

        <Container width="narrow" className="flex flex-col items-center pt-10 pb-20 text-center sm:pt-14 sm:pb-24 lg:pt-20 lg:pb-28">
          <ButtonLink href="/blog" variant="onBlockOutline" size="sm">
            <span aria-hidden="true">&larr;</span>
            All essays
          </ButtonLink>

          <p className="mt-10 flex items-center gap-4 text-[0.6875rem] font-semibold tracking-[0.18em] text-block-foreground/70 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:text-xs">
            <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
            Essay
            <span aria-hidden="true" className="h-px w-10 bg-block-foreground/50" />
          </p>

          {/* One mask for the whole title: it wraps to an unknown number of
              lines, so the lines cannot rise separately. Transform only —
              the words are painted from the first frame. */}
          <h1 className="mt-6 overflow-hidden pb-[0.1em] text-block-foreground">
            <span
              className="block animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none"
              style={{ animationDelay: "120ms" }}
            >
              {post.title}
            </span>
          </h1>

          <dl
            className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-block-foreground/75 animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
            style={{ animationDelay: "360ms" }}
          >
            <div className="flex gap-2">
              <dt className="sr-only">Author</dt>
              <dd>
                By{" "}
                {byTony ? (
                  <Link
                    href="/about"
                    className="font-semibold text-block-foreground underline decoration-block-foreground/30 underline-offset-4 transition-colors hover:decoration-block-foreground"
                  >
                    {author}
                  </Link>
                ) : (
                  <span className="font-semibold text-block-foreground">{author}</span>
                )}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="sr-only">Reading time</dt>
              <dd>{minutes} min read</dd>
            </div>
          </dl>
        </Container>
      </section>

      {/* The cover as a ribbon, pulled up over the field's lower edge: the
          essay's colour, carried over from its card on the index. */}
      <Container className="relative z-10 -mt-8 sm:-mt-10">
        <div className="h-16 overflow-hidden rounded-(--radius-lg) shadow-lift animate-[fade-up_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:h-20" style={{ animationDelay: "480ms" }}>
          <GeneratedCover title={post.title} seed={post.slug} showTitle={false} className="h-full" />
        </div>
      </Container>

      {/* ------------------------------------------------ reading room */}
      <article aria-label={post.title} className="py-16 sm:py-24">
        <Container width="narrow">
          {post.content ? <Prose text={post.content} /> : null}

          {/* Signature — who wrote this, and where to read more of him. Only
              on Tony's own essays: a guest piece already ends with its
              author's name, and "Written by Tony Klinger" under it would be
              false. */}
          {byTony ? (
            <Reveal className="mt-16 flex flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.6875rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Written by
                </p>
                <p className="mt-1 font-display text-2xl font-semibold">{author}</p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground text-pretty">
                  Producer, director, author and coach — sixty years in film,
                  television and publishing.
                </p>
              </div>
              <ButtonLink href="/about" variant="outline" size="sm" className="self-start sm:self-auto">
                About Tony
              </ButtonLink>
            </Reveal>
          ) : null}
        </Container>
      </article>

      {/* ------------------------------------------------ the way on */}
      {older || newer ? (
        <nav aria-label="More essays" className="border-t border-border">
          <Container className="grid sm:grid-cols-2">
            <Neighbour post={newer} direction="newer" />
            <Neighbour post={older} direction="older" />
          </Container>
        </nav>
      ) : null}
    </>
  );
}

/**
 * One half of the foot: the next essay in a direction, set large enough to be
 * an invitation rather than a footnote. Newer on the left, older on the right,
 * matching the index's Newer / Older pager.
 */
function Neighbour({
  post,
  direction,
}: {
  post: BlogPostLink | null;
  direction: "newer" | "older";
}) {
  const older = direction === "older";
  if (!post) return <div className="hidden sm:block" />;

  return (
    <Link
      href={`/blog/${post.slug}`}
      rel={older ? "prev" : "next"}
      className={cn(
        "group/next flex flex-col gap-3 py-10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:py-16",
        older
          ? "border-t border-border sm:border-t-0 sm:border-l sm:pl-10 sm:text-right lg:pl-16"
          : "sm:pr-10 lg:pr-16",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-3 text-[0.6875rem] font-semibold tracking-[0.18em] text-current/70 uppercase",
          older && "sm:justify-end",
        )}
      >
        {!older ? <span aria-hidden="true">&larr;</span> : null}
        {older ? "Older essay" : "Newer essay"}
        {older ? <span aria-hidden="true">&rarr;</span> : null}
      </span>
      <span className="font-display text-2xl leading-snug font-semibold text-balance sm:text-3xl">
        <span className="bg-[linear-gradient(currentColor,currentColor)] bg-size-[0%_1px] bg-bottom-left bg-no-repeat transition-[background-size] duration-(--dur-slow) ease-expo group-hover/next:bg-size-[100%_1px] group-focus-visible/next:bg-size-[100%_1px]">
          {post.title}
        </span>
      </span>
    </Link>
  );
}
