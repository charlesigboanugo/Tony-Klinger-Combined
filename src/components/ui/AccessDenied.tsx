import { Container, Section } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";

/**
 * Access denied — note 06 §38.
 *
 * An authenticated user who lacks a permission is told so plainly, rather than
 * being shown a 404 pretending the route does not exist.
 *
 * Next's `forbidden()` would set a true 403 status, but it is still
 * experimental and requires the `authInterrupts` flag; note 01 §26 says not to
 * adopt experimental features without a specific reason. Revisit when it is
 * stable.
 *
 * The message never names what the resource contains — that would leak
 * information about protected resources (note 06 §38).
 */
export function AccessDenied({ permission }: { permission?: string }) {
  return (
    <Section>
      <Container width="narrow">
        <div className="space-y-5 py-10 text-center">
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Access denied
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            You don&apos;t have access to this area
          </h1>
          <p className="text-muted-foreground">
            Your account is signed in, but it doesn&apos;t hold the permission
            this page requires. If you think that&apos;s wrong, ask an
            administrator to check your role.
          </p>
          {permission ? (
            <p className="text-xs text-muted-foreground">
              Required permission:{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5">
                {permission}
              </code>
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <ButtonLink href="/account">Go to your account</ButtonLink>
            <ButtonLink href="/" variant="outline">
              Back to the site
            </ButtonLink>
          </div>
        </div>
      </Container>
    </Section>
  );
}
