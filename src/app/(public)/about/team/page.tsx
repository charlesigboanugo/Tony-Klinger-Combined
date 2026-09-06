import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { PageHeader } from "@/components/layout/PageHeader";
import { StoredImage } from "@/components/media/StoredImage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listTeam } from "@/lib/content/team";

export const metadata: Metadata = {
  title: "Meet the Team",
  description:
    "The people who teach alongside Tony Klinger — their backgrounds, and the part of the work each of them brings.",
};

/**
 * Meet the Team — note 03 §5.
 *
 * SEPARATED FROM /about DELIBERATELY. The team copy carried over from the
 * coaching platform runs to roughly four times the length of Tony's own
 * biography, and it is about OTHER PEOPLE. Folded into one page it did two
 * things badly: it buried the team under a long biography, and it made the
 * biography read as a preamble to someone else's story.
 *
 * Note 03 §5 permits About sub-routes "when the content genuinely requires
 * separate destinations". The volume and the change of subject are that.
 *
 * Tony is excluded here by slug — he is the subject of /about, and listing him
 * twice would put the same person at two URLs (note 03 §37).
 */
export default async function TeamPage() {
  const team = await listTeam();
  const others = team.filter((m) => m.slug !== "tony-klinger");

  return (
    <Section>
      <Container>
        <nav aria-label="Breadcrumb" className="mb-6 text-sm">
          <Link
            href="/about"
            className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            About
          </Link>
          <span className="mx-2 text-muted-foreground" aria-hidden="true">
            /
          </span>
          <span className="text-foreground">Meet the Team</span>
        </nav>

        <PageHeader
          title="Meet the team"
          description="Tony does not teach alone. Each of these people brings a different part of the work."
          actions={
            <ButtonLink href="/about" variant="outline" size="sm">
              About Tony
            </ButtonLink>
          }
        />

        {others.length > 0 ? (
          <ul className="space-y-10">
            {others.map((member) => (
              <li
                key={member.id}
                className="grid gap-6 sm:grid-cols-[10rem_1fr] sm:items-start"
              >
                {member.storage_path ? (
                  <StoredImage
                    path={member.storage_path}
                    alt={member.name}
                    width={320}
                    height={320}
                    sizes="160px"
                    className="aspect-square w-40 rounded-(--radius) border border-border object-cover"
                  />
                ) : (
                  <div className="aspect-square w-40 rounded-(--radius) border border-border bg-surface-muted" />
                )}

                <div className="min-w-0">
                  <h2 className="text-lg font-medium">{member.name}</h2>
                  {member.role ? (
                    <p className="mt-1 text-sm text-accent">{member.role}</p>
                  ) : null}
                  {member.bio ? (
                    <p className="mt-3 leading-relaxed text-muted-foreground">
                      {member.bio}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No team members listed yet"
            description="Team profiles will appear here once they are published."
            action={<ButtonLink href="/about" variant="outline">Read about Tony</ButtonLink>}
          />
        )}
      </Container>
    </Section>
  );
}
