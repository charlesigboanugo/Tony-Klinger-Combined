import { ButtonLink } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";

/**
 * Academy 404 — note 03 §16, note 06 §38.
 *
 * Deliberately says "not found or not yours": a lesson RLS withholds for lack
 * of access and a lesson that does not exist are indistinguishable by design,
 * so the page cannot honestly tell the learner which it is. It can point them
 * back to what they do have. Rendered inside the Academy workspace, so the
 * sidebar stays in reach.
 */
export default function AcademyNotFound() {
  return (
    <div className="rounded-(--radius-lg) border border-border bg-surface px-6 py-14 text-center sm:px-10">
      <Eyebrow align="center">Not here</Eyebrow>
      <h1 className="mt-4 font-display text-balance">We couldn&apos;t open that</h1>
      <p className="mx-auto mt-4 max-w-md text-muted-foreground">
        It may have moved, or it isn&apos;t part of your Academy. Everything you have access to is
        on your dashboard.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/academy">Your Academy</ButtonLink>
        <ButtonLink href="/academy/courses" variant="outline">
          Your courses
        </ButtonLink>
      </div>
    </div>
  );
}
