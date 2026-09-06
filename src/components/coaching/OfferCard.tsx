import { GeneratedCover } from "@/components/media/GeneratedCover";
import { StoredImage } from "@/components/media/StoredImage";
import {
  Card,
  CardBody,
  CardEyebrow,
  CardLink,
  CardMedia,
  CardText,
  CardTitle,
} from "@/components/ui/Card";
import { formatPrice } from "@/lib/commerce/pricing";
import type { ProductPrice } from "@/lib/content/coaching";
import { cn } from "@/lib/utils/cn";

/**
 * One purchasable coaching offer — note 10 §27, note 07 §37.1.
 *
 * ONE CARD FOR ALL FIVE LISTINGS: courses, group series, cohorts, private
 * coaching and retreats. They were five hand-built lists that happened to look
 * similar, which is how they drifted apart — and why the site read as "every
 * page is the same list" while none of them quite matched.
 *
 * It shows a PRICE where one exists, because §37.1 requires a card and its
 * detail page to answer what it costs. Where a product genuinely has no price
 * the line is omitted rather than filled with a guess.
 *
 * The whole card is clickable via `CardLink`, which overlays the card while
 * keeping exactly one link in the accessibility tree — the title — so a screen
 * reader announces the offer's name rather than the entire card's text.
 */
export function OfferCard({
  href,
  title,
  description,
  eyebrow,
  meta,
  prices,
  storagePath,
  seed,
  priority = false,
  className,
}: {
  href: string;
  title: string;
  description?: string | null;
  /** Small label above the title — the category or level. */
  eyebrow?: string;
  /** A fact worth stating on the card: duration, capacity, date. */
  meta?: string | null;
  prices?: ProductPrice[];
  storagePath?: string | null;
  /** Stable identity for the generated fallback cover. Always the slug. */
  seed: string;
  priority?: boolean;
  className?: string;
}) {
  // Cheapest active price, which is the honest "from" figure. `PriceTag`-style
  // display of every price at once is deliberately not used here: the listing
  // shows an entry point and the detail page shows the full choice.
  const cheapest =
    prices && prices.length > 0
      ? prices.reduce((a, b) => (a.amount <= b.amount ? a : b))
      : null;

  return (
    <Card interactive className={cn("h-full", className)}>
      <CardMedia ratio="16/9">
        {storagePath ? (
          <StoredImage
            path={storagePath}
            alt={title}
            fill
            quality={90}
            priority={priority}
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none"
          />
        ) : (
          /*
            Most coaching entities have no artwork — cohorts and the retreat
            genuinely have none in the library, and inventing a match would be
            the mistake the catalogue work already had to undo. A cover drawn
            from the offer's own title keeps the grid whole without asserting
            anything untrue.
          */
          <GeneratedCover
            title={title}
            seed={seed}
            // No text in the panel: the card body directly beneath already
            // carries the eyebrow AND the title, so printing either here says
            // the same thing twice within an inch. The panel's job is to give
            // the card a distinct, non-repeating identity by colour.
            showTitle={false}
          />
        )}
      </CardMedia>

      <CardBody>
        {eyebrow ? <CardEyebrow>{eyebrow}</CardEyebrow> : null}

        <CardTitle className="mt-1.5 text-lg">
          <CardLink href={href}>{title}</CardLink>
        </CardTitle>

        {description ? (
          <CardText className="mt-2 line-clamp-3">{description}</CardText>
        ) : null}

        <div className="mt-4 flex flex-1 items-end justify-between gap-3 pt-1">
          <div>
            {cheapest ? (
              <p className="font-display text-xl font-semibold tabular-nums">
                {prices && prices.length > 1 ? (
                  <span className="mr-1 font-sans text-xs font-medium text-muted-foreground">
                    from
                  </span>
                ) : null}
                {formatPrice(cheapest.amount, cheapest.currency)}
                {cheapest.billing_type === "recurring" ? (
                  <span className="font-sans text-xs font-normal text-muted-foreground">
                    {" "}
                    / {cheapest.interval ?? "month"}
                  </span>
                ) : null}
              </p>
            ) : null}

            {meta ? (
              <p className="text-xs text-muted-foreground">{meta}</p>
            ) : null}
          </div>

          <span
            aria-hidden="true"
            className="text-primary transition-transform duration-(--dur-base) ease-expo group-hover:translate-x-1 motion-reduce:transform-none"
          >
            &rarr;
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
