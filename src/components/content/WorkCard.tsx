import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import { ExternalMark } from "@/components/navigation/ExternalMark";
import {
  Card,
  CardBody,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import type { CatalogueItem } from "@/lib/content/catalogue";

/**
 * One work in the catalogue — note 10 §27, §42.
 *
 * ONE RATIO FOR EVERY CATEGORY, deliberately.
 *
 * An earlier version varied the frame by medium — portrait jackets, square
 * audio tiles, landscape stills — on the reasoning that a poster and a podcast
 * are different objects. In a grid that produced ragged rows with no shared
 * baseline, and the page read as a jumble rather than a collection.
 *
 * A catalogue is a set of things presented as PEERS, so they share a frame.
 * The artwork inside is never cropped to achieve it (`fit="contain"`), and the
 * leftover space is filled with a blurred copy of the same image — so a
 * landscape still and a portrait jacket occupy the same rectangle without
 * either being distorted or losing its title.
 */
const CARD_RATIO = "3/4" as const;

export function WorkCard({
  item,
  priority = false,
}: {
  item: CatalogueItem;
  /** True for the first row only — everything below the fold stays lazy. */
  priority?: boolean;
}) {
  const external = item.is_external && item.external_url;
  const href = external
    ? item.external_url!
    : `/catalogue/${item.category}/${item.slug}`;

  return (
    <Card interactive className="h-full">
      <CardMedia ratio={CARD_RATIO}>
        {item.storage_path ? (
          <>
            {/*
              Blurred backdrop.

              `fit="contain"` keeps every poster whole, but a landscape still in
              a portrait frame then leaves two dead bands. Filling them with a
              blurred, dimmed copy of the same image turns the letterbox into a
              deliberate surround instead of an accident.

              It costs almost nothing: `sizes="64px"` asks the optimiser for a
              tiny variant — the blur destroys the detail anyway — so this is a
              few hundred bytes, not a second full download.
            */}
            <StoredImage
              path={item.storage_path}
              alt=""
              fill
              sizes="64px"
              className="scale-110 opacity-45 blur-2xl"
            />
            <StoredImage
              path={item.storage_path}
              alt={item.title}
              fill
            // Never crop the artwork: these are jackets and posters whose
            // titles run to the edge, and `cover` was cutting "Alsatia" down
            // to "…tia". Letterboxing against the muted well is the archival
            // choice — the whole cover, always.
            fit="contain"
            quality={90}
            priority={priority}
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 45vw"
              className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.03] motion-reduce:transform-none motion-reduce:transition-none"
            />
          </>
        ) : (
          /*
            No artwork exists for this work. Rather than an empty grey frame,
            it gets a cover drawn from its own title (see GeneratedCover) —
            deterministic, never repeated, and never an unrelated stock photo.
          */
          <GeneratedCover title={item.title} seed={item.slug} />
        )}
      </CardMedia>

      <CardBody className="p-4">
        <CardTitle className="text-base">
          <CardLink
            href={href}
            {...(external
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            {item.title}
          </CardLink>
          {external ? <ExternalMark /> : null}
        </CardTitle>

        {item.description ? (
          <CardText className="mt-1.5 line-clamp-2">{item.description}</CardText>
        ) : null}
      </CardBody>
    </Card>
  );
}
