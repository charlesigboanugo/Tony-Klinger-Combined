import { Container } from "@/components/layout/Container";

/**
 * The shared loading state behind every area's `loading.tsx` (note 10 §23).
 *
 * Shown the instant a link is followed, so a page that is still rendering
 * never leaves the old one frozen on screen. Echoes the common page shape — a
 * heading, a line, a large panel, a row of cards — so the layout barely moves
 * when the real page lands. `framed` adds the page gutters for areas whose
 * layout does not already provide them.
 */
export function PageSkeleton({ framed = false }: { framed?: boolean }) {
  const body = (
    <div role="status" aria-label="Loading" className="animate-pulse motion-reduce:animate-none">
      <div className="h-10 w-2/3 max-w-md rounded-(--radius) bg-surface-muted" />
      <div className="mt-4 h-5 w-full max-w-lg rounded-(--radius) bg-surface-muted" />
      <div className="mt-10 h-56 rounded-(--radius-lg) bg-surface-muted" />
      <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <div className="h-64 rounded-(--radius-lg) bg-surface-muted" />
        <div className="h-64 rounded-(--radius-lg) bg-surface-muted" />
        <div className="hidden h-64 rounded-(--radius-lg) bg-surface-muted xl:block" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );

  return framed ? <Container className="py-12 sm:py-16">{body}</Container> : body;
}
