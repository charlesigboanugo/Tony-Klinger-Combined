/**
 * Academy loading state — note 10 §23.
 *
 * Every Academy page waits on several entitlement-scoped reads; without this
 * a click on a lesson or course left the old page on screen with no sign
 * anything was happening. The skeleton echoes the pages' own shape — a
 * heading, a large panel, a list — so the layout does not jump when they land.
 */
export default function AcademyLoading() {
  return (
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
}
