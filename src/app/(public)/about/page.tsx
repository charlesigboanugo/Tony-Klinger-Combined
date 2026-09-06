import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { StoredImage } from "@/components/media/StoredImage";
import { ButtonLink } from "@/components/ui/Button";
import { Band, BandHeader } from "@/components/layout/Band";
import { Reveal } from "@/components/motion/Reveal";
import { listCatalogue } from "@/lib/content/catalogue";
import { listTeam } from "@/lib/content/team";

export const metadata: Metadata = {
  title: "About",
  description:
    "Tony Klinger — producer, director, author and educator, with six decades in film, television and music, and the team who teach alongside him.",
};

/**
 * About — note 03 §8.
 *
 * The biography and the team bios are the REAL copy, taken from the coaching
 * app's own About pages rather than written for this build. The previous
 * version of this page said in as many words that it was a placeholder.
 *
 * Team members come from the database, not from this file, because they change:
 * someone joins, a role changes, a bio is rewritten. That should not require a
 * deploy (note 06 §16).
 */
export default async function AboutPage() {
  const [team, works] = await Promise.all([listTeam(), listCatalogue()]);

  /*
    The biography names a dozen films and books. Showing them turns a wall of
    prose into something you can look at — and every cover here is a real
    published work already in the catalogue, so nothing is invented and nothing
    is duplicated: these are links to the existing rows.
  */
  const covered = works.filter((w) => w.storage_path).slice(0, 6);
  const tony = team.find((m) => m.slug === "tony-klinger");
  const others = team.filter((m) => m.slug !== "tony-klinger");

  return (
    <>
      <Section className="border-b border-border bg-surface">
        <Container>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-5">
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                About Tony Klinger
              </h1>
              <p className="text-lg text-muted-foreground text-pretty">
                Six decades producing film and television, writing books, and
                working alongside some of the most recognisable names in music
                and cinema.
              </p>
            </div>

            {/* `priority` because this is the largest element above the fold —
                without it the hero is the last thing to arrive. */}
            {tony?.storage_path ? (
              <StoredImage
                path={tony.storage_path}
                alt="Tony Klinger"
                width={640}
                height={640}
                priority
                sizes="(min-width: 1024px) 40vw, 100vw"
                className="aspect-square w-full rounded-(--radius) border border-border object-cover"
              />
            ) : (
              <div className="aspect-square w-full rounded-(--radius) border border-border bg-surface-muted" />
            )}
          </div>
        </Container>
      </Section>

      {covered.length > 0 ? (
        <Band tone="indigo">
          <BandHeader
            eyebrow="The work"
            title="Six decades of it"
            lead="Films produced and directed, books written, and the projects behind them — all of it in the catalogue."
          />

          <ul className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-6">
            {covered.map((work, i) => (
              <Reveal as="li" key={work.id} delay={(i % 6) * 50} className="h-full">
                <Link href={`/catalogue/${work.category}/${work.slug}`} className="group block">
                  <span className="relative block aspect-[2/3] overflow-hidden rounded-(--radius) bg-black/25">
                    <StoredImage
                      path={work.storage_path}
                      alt={work.title}
                      fill
                      fit="contain"
                      sizes="(min-width: 1024px) 15vw, 45vw"
                      className="transition-transform duration-(--dur-slow) ease-expo group-hover:scale-[1.04] motion-reduce:transform-none"
                    />
                  </span>
                  <span className="mt-2 block text-xs leading-snug text-block-foreground/85">
                    {work.title}
                  </span>
                </Link>
              </Reveal>
            ))}
          </ul>

          <div className="mt-10">
            <ButtonLink href="/catalogue" variant="onBlockOutline">
              Browse the catalogue
            </ButtonLink>
          </div>
        </Band>
      ) : null}

      <Section>
        <Container width="narrow">
          <div className="space-y-5 leading-relaxed">
            <p>
              Tony Klinger is an award-winning producer, director and educator
              with decades of experience in the international film industry. He
              began in the mid-1960s as an assistant director on{" "}
              <em>The Avengers</em>, and had taken on senior responsibilities
              before he turned 21.
            </p>
            <p>
              His work includes <em>The Kids Are Alright</em> with The Who,{" "}
              <em>Extremes</em>, <em>Deep Purple Rises Over Japan</em> and{" "}
              <em>The Butterfly Ball</em>, and collaborations with his father,
              the producer Michael Klinger, on <em>Gold</em> and{" "}
              <em>Shout at the Devil</em>. He has worked with Jack Nicholson,
              Peter Ustinov, Lee Marvin, Sir John Gielgud, Roger Moore, Michael
              Caine, Peter Finch, Susannah York and Deep Purple, among others,
              and has produced across more than thirty countries.
            </p>
            <p>
              More recently he premiered <em>Full Circle</em> (2008) and{" "}
              <em>The Man Who Got Carter</em> (2018), a tribute to his father
              featuring Sir Michael Caine and Mike Hodges; co-produced and
              directed <em>Solo2Darwin</em> (2021); and executive-produced{" "}
              <em>Sisters</em>, following the Afghan all-female orchestra Zohra.
              In 2023 he presented <em>Dirty, Sexy and Totally Iconic</em>,
              marking fifty years of <em>Get Carter</em>.
            </p>
            <p>
              He is the author of <em>Who Knows</em> (previously{" "}
              <em>Twilight of the Gods</em> and <em>The Who and I</em>),{" "}
              <em>Under God&apos;s Table</em>, <em>The Butterfly Boy</em>,{" "}
              <em>Alsatia: The Search for Treasure</em> and two books on getting
              into and getting made in the movie business.
            </p>
            <p>
              Alongside the work itself, Tony has lectured and led programmes at
              the Bournemouth Film School, the Northern Film School and the
              University of East London, served as National Secretary of the
              Association of Media Practice Educators, and co-founded the Screen
              Commission Northants. He received the Lifetime Achievement Award at
              the Romford Film Festival in 2018, and holds The Queen&apos;s
              Anniversary Award for Education.
            </p>
            <p>
              In 2016 he founded Give-Get-Go, a community outreach project
              opening up filmmaking to people who would not otherwise get near
              it, and in 2019 began coaching directly — which is what this site
              exists for.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink href="/catalogue">Browse the catalogue</ButtonLink>
            <ButtonLink href="/coaching" variant="outline">
              Work with Tony
            </ButtonLink>
          </div>
        </Container>
      </Section>

      {/* The team lives at /about/team, not here. Its copy runs to roughly
          four times this biography and is about other people — inlined, it
          buried the team and made this page read as a preamble to someone
          else's story (note 03 §5). */}
      {others.length > 0 ? (
        <Section className="border-t border-border bg-surface">
          <Container>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Tony does not teach alone
            </h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              {others.length} other {others.length === 1 ? "person brings" : "people bring"}{" "}
              a different part of the work — from development and production to
              the business side.
            </p>
            <div className="mt-8">
              <ButtonLink href="/about/team">Meet the team</ButtonLink>
            </div>
          </Container>
        </Section>
      ) : null}
    </>
  );
}
