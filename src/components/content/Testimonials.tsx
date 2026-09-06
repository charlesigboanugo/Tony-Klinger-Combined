import type { Testimonial } from "@/lib/content/testimonials";

/**
 * Testimonials — note 10 §23.
 *
 * Rendered as <blockquote>/<cite>, which is what they are: quoted speech with
 * an attribution. A styled <div> would look the same and mean nothing to a
 * screen reader.
 *
 * SEVERAL QUOTES ARE GENUINELY ANONYMOUS — they came from client satisfaction
 * surveys — so the attribution line is optional rather than padded with an
 * invented name.
 */
export function Testimonials({
  testimonials,
  heading = "What people say",
  columns = 3,
}: {
  testimonials: Testimonial[];
  heading?: string;
  columns?: 2 | 3;
}) {
  if (testimonials.length === 0) return null;

  return (
    <section aria-labelledby="testimonials-heading">
      <h2
        id="testimonials-heading"
        className="text-2xl font-semibold tracking-tight sm:text-3xl"
      >
        {heading}
      </h2>

      <ul
        className={`mt-8 grid gap-5 ${
          columns === 2 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {testimonials.map((t) => (
          <li key={t.id}>
            <figure className="flex h-full flex-col rounded-(--radius) border border-border bg-surface p-6">
              <blockquote className="flex-1 text-sm leading-relaxed text-pretty">
                {t.quote}
              </blockquote>
              {t.attributed_to || t.attribution_detail ? (
                <figcaption className="mt-4 text-sm">
                  {t.attributed_to ? (
                    <cite className="font-medium not-italic">{t.attributed_to}</cite>
                  ) : null}
                  {t.attribution_detail ? (
                    <span className="block text-muted-foreground">
                      {t.attribution_detail}
                    </span>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
