import type { Metadata } from "next";

import { countPosts } from "@/lib/content/blog";

export { default } from "../../page";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/blog/page/[page]">): Promise<Metadata> {
  const { page } = await params;
  return { title: `Blog, page ${page}`, alternates: { canonical: `/blog/page/${page}` } };
}

/** Every archive page is built ahead; new ones appear on the next rebuild. */
export async function generateStaticParams() {
  const pages = Math.ceil((await countPosts()) / 24);
  return Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => ({ page: String(i + 2) }));
}
