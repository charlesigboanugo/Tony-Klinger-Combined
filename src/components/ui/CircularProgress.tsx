/**
 * A small circular progress ring — note 07 §32.
 *
 * Pure SVG, no library: a stroke-dasharray trick on two stacked circles, so
 * it costs nothing beyond the linear bar it replaces. Percentage is real,
 * selectable text in the centre, not baked into the graphic, so it reads
 * the same to a screen reader as "counted, not estimated" does elsewhere on
 * this page (note 07 §32) — the ring is decorative, the numbers beside it
 * are what actually says how far through something is.
 */
export function CircularProgress({
  percent,
  size = 36,
  strokeWidth = 3,
  color = "var(--primary)",
}: {
  /** 0–100. Not clamped by this component — pass a value already in range. */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** A CSS colour value, e.g. `"var(--accent)"`. Defaults to the site's
   * primary colour; a caller inside a workspace with its own identity
   * accent (note 04 §32.2) passes that instead. */
  color?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-muted)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-(--dur-slow) ease-expo motion-reduce:transition-none"
      />
    </svg>
  );
}
