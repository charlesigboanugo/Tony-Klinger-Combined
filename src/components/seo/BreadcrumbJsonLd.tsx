import { JsonLd } from "@/components/seo/JsonLd";
import { absoluteUrl } from "@/lib/urls";

/**
 * Breadcrumb trail for search engines, so a result can show where the page
 * sits ("Coaching › Courses › …") instead of a bare address.
 *
 * Data only, nothing drawn: the owner rejects a link strip under the
 * masthead, and every detail page already has its way back. Home is added
 * first; pass the rest of the trail, ending with the page itself.
 */
export function BreadcrumbJsonLd({ trail }: { trail: { name: string; path: string }[] }) {
  const items = [{ name: "Home", path: "/" }, ...trail];
  return (
    <JsonLd
      data={{
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: absoluteUrl(item.path),
        })),
      }}
    />
  );
}
