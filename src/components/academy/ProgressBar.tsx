import { cn } from "@/lib/utils/cn";

/**
 * Lessons done out of lessons in total — note 07 §34.2.
 *
 * Teal, because progress is state (the accent's job, note 10 §5). The label
 * says the counted fact in words for assistive technology; the bar is the
 * same fact for the eye, never the only carrier of it.
 */
export function ProgressBar({
  completed,
  total,
  className,
  size = "md",
  onBlock = false,
}: {
  completed: number;
  total: number;
  className?: string;
  size?: "sm" | "md";
  /** On a noir panel: a translucent light track instead of the paper tone. */
  onBlock?: boolean;
}) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={completed}
      aria-label={`${completed} of ${total} lessons complete`}
      className={cn(
        "w-full overflow-hidden rounded-full",
        onBlock ? "bg-block-foreground/15" : "bg-surface-muted",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-(--dur-slow) ease-expo"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
