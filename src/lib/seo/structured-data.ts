import type { ProductPrice } from "@/lib/content/coaching";
import type { EventDetail } from "@/lib/content/events";
import type { CatalogueItem } from "@/lib/content/catalogue";
import { designPhotos } from "@/lib/site/design-photos";
import { socialLinks, substack } from "@/lib/site/links";
import { publicStorageUrl } from "@/lib/storage/public-url";
import { absoluteUrl } from "@/lib/urls";

/**
 * Structured data (schema.org) for the pages search engines can describe
 * richly: Tony himself, the site, events, courses and catalogue works.
 *
 * Only facts the database holds are stated. A field with no value is left
 * out rather than guessed, because a wrong date or price in a search result is
 * worse than a plain one.
 */

/** Tony, referred to by `@id` from everything else on the site. */
export function tonyPerson() {
  return {
    "@type": "Person",
    "@id": absoluteUrl("/#tony"),
    name: "Tony Klinger",
    url: absoluteUrl("/about"),
    image: absoluteUrl(designPhotos.homeHero.src),
    jobTitle: "Film producer, author and coach",
    sameAs: [...socialLinks.map((l) => l.href), ...(substack ? [substack.href] : [])],
  };
}

const tonyRef = () => ({ "@id": absoluteUrl("/#tony") });

export function websiteData() {
  return {
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: "Tony Klinger",
    url: absoluteUrl("/"),
    publisher: tonyRef(),
  };
}

function offer(price: ProductPrice, url: string, soldOut = false) {
  return {
    "@type": "Offer",
    price: (price.amount / 100).toFixed(2),
    priceCurrency: price.currency.toUpperCase(),
    availability: soldOut ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
    url,
  };
}

const ATTENDANCE = {
  in_person: "https://schema.org/OfflineEventAttendanceMode",
  online: "https://schema.org/OnlineEventAttendanceMode",
  hybrid: "https://schema.org/MixedEventAttendanceMode",
} as const;

/** An event, or null when it has no start date (search engines require one). */
export function eventData(event: EventDetail) {
  if (!event.starts_at) return null;
  const url = absoluteUrl(`/events/${event.slug}`);
  const place =
    event.location || event.venue_address
      ? {
          "@type": "Place",
          name: event.location ?? event.venue_address,
          ...(event.venue_address ? { address: event.venue_address } : {}),
        }
      : null;
  const virtual = { "@type": "VirtualLocation", url };
  const location =
    event.format === "online" ? virtual : event.format === "hybrid" ? [place ?? virtual, virtual] : place;
  const soldOut = event.capacity != null && event.taken >= event.capacity;
  const images = [event.storagePath, ...event.gallery.map((g) => g.path)]
    .map((p) => publicStorageUrl(p))
    .filter((u): u is string => Boolean(u));

  return {
    "@type": "Event",
    name: event.name,
    ...(event.description ? { description: event.description } : {}),
    url,
    startDate: event.starts_at,
    ...(event.ends_at ? { endDate: event.ends_at } : {}),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: ATTENDANCE[event.format],
    ...(location ? { location } : {}),
    ...(images.length ? { image: images } : {}),
    organizer: tonyRef(),
    performer: tonyRef(),
    ...(event.is_free
      ? { offers: offer({ amount: 0, currency: "gbp", billing_type: "one_time", interval: null }, url, soldOut) }
      : event.ticket
        ? { offers: offer(event.ticket.price, url, soldOut) }
        : {}),
  };
}

export function courseData(course: {
  title: string;
  slug: string;
  description: string | null;
  storagePath: string | null;
  prices: ProductPrice[];
}) {
  const url = absoluteUrl(`/coaching/courses/${course.slug}`);
  const image = publicStorageUrl(course.storagePath);
  const price = course.prices.find((p) => p.billing_type !== "recurring");
  return {
    "@type": "Course",
    name: course.title,
    ...(course.description ? { description: course.description } : {}),
    url,
    ...(image ? { image } : {}),
    provider: tonyRef(),
    hasCourseInstance: { "@type": "CourseInstance", courseMode: "Online", instructor: tonyRef() },
    ...(price ? { offers: { ...offer(price, url), category: "Paid" } } : {}),
  };
}

const WORK_TYPE: Record<string, string> = { books: "Book", films: "Movie", podcasts: "PodcastSeries" };

export function catalogueWorkData(item: CatalogueItem) {
  const image = publicStorageUrl(item.storage_path);
  return {
    "@type": WORK_TYPE[item.category] ?? "CreativeWork",
    name: item.title,
    ...(item.description ? { description: item.description } : {}),
    url: absoluteUrl(`/catalogue/${item.category}/${item.slug}`),
    ...(image ? { image } : {}),
  };
}
