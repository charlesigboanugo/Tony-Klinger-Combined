import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";

import { Container, Section } from "@/components/layout/Container";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { PhotoCredit } from "@/components/media/PhotoCredit";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow } from "@/components/ui/Button";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  countPosts,
  listPostsPage,
  readingMinutes,
  type BlogPostSummary,
} from "@/lib/content/blog";
import { designPhotos } from "@/lib/site/design-photos";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Essays by Tony Klinger on filmmaking, producing, the industry and the world around it.",
  alternates: { canonical: "/blog" },
};

const PER_PAGE = 24;

const beat = (ms: number) => ({ animationDelay: `${ms}ms` }) as CSSProperties;

/** The page-title size (note 10 §9.1), for title words set outside the h1.
 *  Not the home title card's size (owner, 2026-09-26: only home is that big). */
const H1_LOOK =
  "font-display text-(length:--text-h1) leading-none font-semibold tracking-[-0.025em]";

/**
 * The blog — note 03 §6, note 10 §42.
 *
 * A CENTRED HERO, NOT A SPLIT. Words on one side and a photo on the other had
 * become the site's default page opening (owner, 2026-09-25), so this one is
 * symmetrical: the title parted around an arched portrait, the words either
 * side of the frame on wide screens and above and below it on narrow ones.
 *
 * Then CARDS. Each essay is a card with its generated cover; on page 1 the
 * newest takes a double-size cell, so the grid opens on a lead rather than a
 * uniform wall. 24 per page, with a numbered pager.
 *
 * NO DATES, NO FIGURES. The stored dates are republication dates and misdate
 * the writing (owner, 2026-09-25); they order the archive and nothing else.
 * Counts and essay numbers were removed on the owner's instruction the same
 * day.
 */
export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const params = await searchParams;
  const raw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;

  const [posts, total] = await Promise.all([listPostsPage(page, PER_PAGE), countPosts()]);
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  // The newest post leads page 1 only — on page 3 of an archive there is no
  // "lead story", and promoting an arbitrary one would misstate its weight.
  const lead = page === 1 ? (posts[0] ?? null) : null;
  const rest = lead ? posts.slice(1) : posts;

  return (
    <>
      <BlogHero />

      <Section className="pt-8 sm:pt-12">
        <Container>
          {posts.length === 0 ? (
            <EmptyState title="No essays yet" description="Check back shortly." />
          ) : (
            <>
              <h2 id="essays-heading" className="sr-only">
                Essays
              </h2>

              {/* Page 1: the lead fills a 2×2 cell, so 1 + 23 cards close the
                  last row exactly (4 + 23 = 27 cells, 9 rows of 3). Later
                  pages are 24 cards, 8 full rows. */}
              <ul
                aria-labelledby="essays-heading"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7"
              >
                {lead ? (
                  <Reveal as="li" className="h-full sm:col-span-2 lg:row-span-2">
                    <LeadCard post={lead} />
                  </Reveal>
                ) : null}
                {rest.map((post, i) => (
                  <Reveal as="li" key={post.id} delay={(i % 3) * 60} className="h-full">
                    <EssayCard post={post} />
                  </Reveal>
                ))}
              </ul>

              {lastPage > 1 ? <Pager page={page} lastPage={lastPage} /> : null}
            </>
          )}

          {/*
            No newsletter block here. The public footer carries one on every
            page, so an inline copy meant /blog asked twice on one screen —
            which reads as nagging and halves the response to both.
          */}
        </Container>
      </Section>
    </>
  );
}

/**
 * The title parted around an arched portrait. The real h1 is one element for
 * assistive technology; the two halves drawn either side of the photo are
 * the same words, hidden from it, so the heading is read once and whole.
 *
 * All entrance motion is CSS from the server HTML (the home hero's
 * `line-rise` and `fade-up`), each opting out under reduced motion.
 */
function BlogHero() {
  const photo = designPhotos.blog;

  return (
    <section className="relative isolate overflow-hidden">
      {/* A soft pool of light behind the arch — the paper's own tone,
          deepened, so the portrait sits in something rather than on nothing. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-24 left-1/2 -z-10 aspect-square w-[min(90vw,52rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--muted),transparent)]"
      />

      <Container className="pt-12 pb-10 text-center sm:pt-16 lg:pt-20">
        <p
          className="flex items-center justify-center gap-4 text-xs font-semibold tracking-[0.18em] text-current/70 uppercase animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          style={beat(60)}
        >
          <span aria-hidden="true" className="h-px w-10 bg-primary" />
          Writing
          <span aria-hidden="true" className="h-px w-10 bg-primary" />
        </p>

        <h1 className="sr-only">Notes from the work</h1>

        <div className="mt-8 flex flex-col items-center gap-6 sm:mt-10 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-10">
          <HalfTitle text="Notes from" delay={140} className="xl:justify-self-end xl:text-right" />

          <figure
            className="w-56 animate-[fade-up_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none sm:w-64 xl:w-60"
            style={beat(260)}
          >
            {/* The arch: a rounded top on a 3:4 frame, the photograph's own
                ratio, so nothing of it is cropped away. */}
            <div className="relative aspect-3/4 overflow-hidden rounded-t-full rounded-b-(--radius-lg) bg-surface-muted shadow-lift">
              <Parallax speed={0.06} className="absolute inset-x-0 top-[-8%] h-[116%]">
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  priority
                  quality={90}
                  sizes="(min-width: 640px) 16rem, 14rem"
                  className={cn("object-cover", photo.focus)}
                />
              </Parallax>
            </div>
            <PhotoCredit src={photo.src} className="text-muted-foreground" />
          </figure>

          <HalfTitle text="the work" delay={250} italic className="xl:justify-self-start xl:text-left" />
        </div>

        <p
          className="measure mx-auto mt-8 text-lg leading-relaxed text-muted-foreground text-pretty animate-[fade-up_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none"
          style={beat(460)}
        >
          Six decades in film and publishing, written down as it happened — on
          producing, writing, the industry, and the people in it.
        </p>
      </Container>
    </section>
  );
}

function HalfTitle({
  text,
  delay,
  italic = false,
  className,
}: {
  text: string;
  delay: number;
  /** The second half, set lighter and in italic, as on the home hero. */
  italic?: boolean;
  className?: string;
}) {
  return (
    // Padding below and a matching negative margin give descenders room
    // inside the clipping mask the words rise out of.
    <span aria-hidden="true" className={cn("mb-[-0.1em] block overflow-hidden pb-[0.1em]", className)}>
      <span
        className={cn(
          H1_LOOK,
          "block whitespace-nowrap animate-[line-rise_1.1s_var(--ease-out-expo)_both] motion-reduce:animate-none",
          italic && "font-normal text-muted-foreground italic",
        )}
        style={beat(delay)}
      >
        {text}
      </span>
    </span>
  );
}

/**
 * One essay. The generated cover is the card's picture (no post has artwork);
 * it drifts slightly larger on hover while the card lifts.
 */
function EssayCard({ post }: { post: BlogPostSummary }) {
  return (
    <Card interactive className="h-full">
      <CardMedia ratio="16/9">
        <div className="absolute inset-0 transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transition-none">
          <GeneratedCover title={post.title} seed={post.slug} showTitle={false} className="h-full" />
        </div>
      </CardMedia>

      <CardBody className="p-6">
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {readingMinutes(post.word_count)} min read
        </p>

        <CardTitle as="h3" className="mt-2 text-xl text-balance">
          <CardLink href={`/blog/${post.slug}`}>{post.title}</CardLink>
        </CardTitle>

        {post.excerpt ? <CardText className="mt-3 line-clamp-3">{post.excerpt}</CardText> : null}

        <ReadMore className="text-primary" />
      </CardBody>
    </Card>
  );
}

/**
 * The newest essay as a poster: its cover fills the whole double cell and the
 * words are set on it, in white over a darkening wash, rather than under a
 * cover stretched to fill the space with nothing in it.
 */
function LeadCard({ post }: { post: BlogPostSummary }) {
  return (
    <Card interactive className="h-full min-h-104 border-transparent text-white lg:min-h-0">
      <div className="absolute inset-0 transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.03] motion-reduce:transition-none">
        <GeneratedCover title={post.title} seed={post.slug} showTitle={false} eyebrow="Latest essay" className="h-full" />
      </div>
      <div aria-hidden="true" className="absolute inset-0 bg-linear-to-t from-black/80 via-black/35 to-transparent" />

      <div className="relative mt-auto flex flex-col p-6 sm:p-10">
        <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-white/75 uppercase">
          {readingMinutes(post.word_count)} min read
        </p>
        <h3 className="mt-3 font-display text-(length:--text-h2) leading-[1.08] font-semibold text-balance">
          <CardLink href={`/blog/${post.slug}`}>{post.title}</CardLink>
        </h3>
        {post.excerpt ? (
          <p className="measure mt-4 line-clamp-3 text-base leading-relaxed text-white/85 sm:text-lg">
            {post.excerpt}
          </p>
        ) : null}
        <ReadMore className="text-white" />
      </div>
    </Card>
  );
}

function ReadMore({ className }: { className?: string }) {
  return (
    <p className={cn("mt-auto flex items-center gap-2 pt-5 text-sm font-semibold", className)}>
      Read the essay
      <span
        aria-hidden="true"
        className="transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transition-none"
      >
        <ButtonArrow />
      </span>
    </p>
  );
}

/**
 * Numbered pages, with the current one marked. At most seven slots: first,
 * last, the current page and its neighbours, with a gap marker between runs —
 * so a long archive never produces a row of forty numbers.
 */
function Pager({ page, lastPage }: { page: number; lastPage: number }) {
  const href = (n: number) => (n === 1 ? "/blog" : `/blog?page=${n}`);

  const wanted = new Set([1, lastPage, page - 1, page, page + 1]);
  const pages = [...wanted].filter((n) => n >= 1 && n <= lastPage).sort((a, b) => a - b);
  const slots: (number | "gap")[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) slots.push("gap");
    slots.push(n);
  });

  const step =
    "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-(--dur-fast) hover:text-primary";

  return (
    <nav aria-label="Blog pages" className="mt-14 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={step}>
          <span aria-hidden="true">&larr;</span> Newer
        </Link>
      ) : (
        <span className="w-24" />
      )}

      {/* Seven 40px slots do not fit beside the arrows on a phone. */}
      <p className="text-sm text-muted-foreground tabular-nums sm:hidden">
        Page {page} of {lastPage}
      </p>

      <ol className="hidden items-center gap-1 sm:flex">
        {slots.map((slot, i) =>
          slot === "gap" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              &hellip;
            </li>
          ) : (
            <li key={slot}>
              <Link
                href={href(slot)}
                aria-current={slot === page ? "page" : undefined}
                className={cn(
                  "inline-flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-(--dur-fast)",
                  slot === page
                    ? "bg-foreground font-semibold text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {slot}
              </Link>
            </li>
          ),
        )}
      </ol>

      {page < lastPage ? (
        <Link href={href(page + 1)} rel="next" className={step}>
          Older <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : (
        <span className="w-24" />
      )}
    </nav>
  );
}
