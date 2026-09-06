import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { GeneratedCover } from "@/components/media/GeneratedCover";
import { Reveal } from "@/components/motion/Reveal";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { countPosts, listPostsPage } from "@/lib/content/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Writing on filmmaking, producing and the industry.",
};

const PER_PAGE = 24;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPage({ searchParams }: PageProps<"/blog">) {
  const params = await searchParams;
  const raw = typeof params.page === "string" ? Number(params.page) : 1;
  const page = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;

  const [posts, total] = await Promise.all([
    listPostsPage(page, PER_PAGE),
    countPosts(),
  ]);

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));

  // The newest post leads the first page only — on page 3 of an archive there
  // is no "lead story", and promoting an arbitrary one would be a lie about
  // its importance.
  const lead = page === 1 ? (posts[0] ?? null) : null;
  const rest = page === 1 ? posts.slice(1) : posts;

  return (
    <Section>
      <Container>
        <PageHeader
          eyebrow="Writing"
          title="Notes from the work"
          description="Six decades in film and publishing, written down as it happened — on producing, writing, the industry, and the people in it."
        />

        {posts.length === 0 ? (
          <EmptyState title="No posts yet" description="Check back shortly." />
        ) : (
          <>
            {/*
              LEAD POST. A magazine gives its most recent piece more room than
              the rest; a uniform grid says every article is equally important,
              which is both untrue and visually monotonous — the "everything is
              the same list" problem this redesign is fixing.
            */}
            {lead ? (
              <Reveal className="mb-10">
                <Card interactive className="md:flex-row">
                  <div className="relative md:w-[46%]">
                    <CardMedia ratio="16/9" className="h-full md:aspect-auto">
                      <GeneratedCover
                        title={lead.title}
                        seed={lead.slug}
                        eyebrow="Latest"
                        className="absolute inset-0"
                      />
                    </CardMedia>
                  </div>

                  <CardBody className="justify-center p-6 sm:p-8 md:w-[54%]">
                    {lead.published_at ? (
                      <time
                        dateTime={lead.published_at}
                        className="text-xs font-semibold tracking-[0.14em] text-primary uppercase"
                      >
                        {formatDate(lead.published_at)}
                      </time>
                    ) : null}

                    <CardTitle as="h2" className="mt-2 text-2xl sm:text-3xl">
                      <CardLink href={`/blog/${lead.slug}`}>{lead.title}</CardLink>
                    </CardTitle>

                    {lead.excerpt ? (
                      <CardText className="mt-3 line-clamp-3 text-base">
                        {lead.excerpt}
                      </CardText>
                    ) : null}
                  </CardBody>
                </Card>
              </Reveal>
            ) : null}

            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post, i) => (
                <Reveal as="li" key={post.id} delay={(i % 3) * 60} className="h-full">
                  <Card interactive className="h-full">
                    <CardMedia ratio="16/9">
                      {/*
                        No post in the archive has a cover image, and there are
                        380 images total — so a relevant photograph for each of
                        172 posts does not exist. This draws one from the post's
                        own title instead: deterministic, unique per slug, and
                        no image request at all.
                      */}
                      <GeneratedCover
                        title={post.title}
                        seed={post.slug}
                        // The title is printed directly beneath this panel, so
                        // repeating it inside the panel says the same thing
                        // twice an inch apart. The year identifies the piece
                        // instead, and the colour still comes from the slug.
                        showTitle={false}
                        eyebrow={
                          post.published_at
                            ? new Date(post.published_at).getFullYear().toString()
                            : undefined
                        }
                        className="absolute inset-0"
                      />
                    </CardMedia>

                    <CardBody>
                      {post.published_at ? (
                        <time
                          dateTime={post.published_at}
                          className="text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                        >
                          {formatDate(post.published_at)}
                        </time>
                      ) : null}

                      <CardTitle className="mt-1.5 text-lg">
                        <CardLink href={`/blog/${post.slug}`}>{post.title}</CardLink>
                      </CardTitle>

                      {post.excerpt ? (
                        <CardText className="mt-2 line-clamp-3">
                          {post.excerpt}
                        </CardText>
                      ) : null}
                    </CardBody>
                  </Card>
                </Reveal>
              ))}
            </ul>

            {lastPage > 1 ? (
              <nav
                aria-label="Blog pages"
                className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-6"
              >
                {page > 1 ? (
                  <Link
                    href={page - 1 === 1 ? "/blog" : `/blog?page=${page - 1}`}
                    rel="prev"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    &larr; Newer
                  </Link>
                ) : (
                  <span />
                )}

                <p className="text-sm text-muted-foreground">
                  Page {page} of {lastPage} &middot; {total} posts
                </p>

                {page < lastPage ? (
                  <Link
                    href={`/blog?page=${page + 1}`}
                    rel="next"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Older &rarr;
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}

        {/*
          No newsletter block here. The public footer carries one on every page,
          so an inline copy meant /blog asked twice on one screen — which reads
          as nagging and halves the response to both.
        */}
      </Container>
    </Section>
  );
}
