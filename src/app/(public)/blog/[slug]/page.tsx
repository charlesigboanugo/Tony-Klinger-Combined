import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container, Section } from "@/components/layout/Container";
import { BackLink } from "@/components/ui/BackLink";
import { getPost } from "@/lib/content/blog";

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return post
    ? { title: post.title, description: post.excerpt ?? undefined }
    : { title: "Not found" };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = await getPost(slug);

  // Covers both "no such post" and "draft" — RLS returns nothing for a draft,
  // so an unpublished slug is indistinguishable from a missing one.
  if (!post) notFound();

  return (
    <Section>
      <Container width="narrow">
        <BackLink href="/blog">All posts</BackLink>

        <article className="mt-6 space-y-6">
          {post.published_at ? (
            <time
              dateTime={post.published_at}
              className="block text-xs tracking-wide text-muted-foreground uppercase"
            >
              {new Date(post.published_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </time>
          ) : null}

          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {post.title}
          </h1>

          {post.content ? (
            <div className="space-y-4 leading-relaxed">
              {post.content.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}
        </article>
      </Container>
    </Section>
  );
}
