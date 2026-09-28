import Link from "next/link";

import { Container, Section } from "@/components/layout/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ButtonLink } from "@/components/ui/Button";

/** Global 404 — note 03 §16. */
export default function NotFound() {
  return (
    <Section>
      <Container width="narrow">
        <div className="space-y-6 py-12 text-center">
          <Eyebrow align="center">404</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            We couldn&apos;t find that page
          </h1>
          <p className="text-muted-foreground">
            The page may have moved, or the link may be out of date.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/">Go home</ButtonLink>
            <ButtonLink href="/coaching" variant="outline">
              Explore coaching
            </ButtonLink>
          </div>
          <p className="text-sm text-muted-foreground">
            Or <Link href="/contact" className="underline">get in touch</Link>.
          </p>
        </div>
      </Container>
    </Section>
  );
}
