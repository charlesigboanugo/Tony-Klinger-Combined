import type { Metadata } from "next";

import { countPosts } from "@/lib/content/blog";
import { pageMetadata } from "@/lib/seo/metadata";

export { default } from "../../page";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/blog/page/[page]">): Promise<Metadata> {
  const { page } = await params;
  return pageMetadata({
    title: `Blog, page ${page}`,
    description: `Essays by Tony Klinger on filmmaking, producing, the industry and the world around it — page ${page}.`,
    path: `/blog/page/${page}`,
  });
}

/** Every archive page is built ahead; new ones appear on the next rebuild. */
export async function generateStaticParams() {
  const pages = Math.ceil((await countPosts()) / 24);
  return Array.from({ length: Math.max(pages - 1, 0) }, (_, i) => ({ page: String(i + 2) }));
}
