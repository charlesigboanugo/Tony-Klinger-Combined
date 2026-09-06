/**
 * External-destination indicator — note 11.
 *
 * The arrow is decorative and hidden from assistive technology; the meaning is
 * carried by real text in a visually-hidden span instead. A screen reader
 * announcing "Give-Get-Go Education, opens in a new tab" is the equivalent of
 * seeing the arrow — an `↗` glyph alone announces as nothing, or worse, as
 * "north east arrow".
 */
export function ExternalMark({ className }: { className?: string }) {
  return (
    <>
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className={className ?? "h-3 w-3 shrink-0 opacity-70"}
      >
        <path
          d="M4 2h6v6M10 2 2.5 9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">(opens in a new tab)</span>
    </>
  );
}
