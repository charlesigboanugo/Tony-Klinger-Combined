import { ButtonLink } from "@/components/ui/Button";
import type { JoinState, Recording } from "@/lib/academy/delivery";
import { JOIN_OPENS_MINUTES } from "@/lib/academy/delivery";
import { formatTime } from "@/lib/academy/format";
import { dateBadge } from "@/lib/account/format";
import { cn } from "@/lib/utils/cn";

/**
 * Pieces shared by every live-session row in the Academy — cohort workshops
 * and Group Coaching sessions (note 07 §35, §36).
 */

/**
 * The joining control. The link itself exists in the page only while the
 * window is open (`joinState()` in lib/academy/delivery) — before that the
 * row says when it will appear rather than showing a dead button.
 */
export function JoinAction({ join, onBlock = false }: { join: JoinState; onBlock?: boolean }) {
  switch (join.state) {
    case "open":
      return (
        <a
          href={join.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-card transition-transform hover:-translate-y-0.5",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            onBlock ? "bg-block-foreground text-secondary" : "bg-button text-button-foreground",
          )}
        >
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          Join now
        </a>
      );
    case "soon":
      return (
        <span className={cn("text-sm", onBlock ? "text-block-foreground/75" : "text-muted-foreground")}>
          {join.today ? `Join link opens at ${formatTime(join.opensAt)}` : `Join link opens ${JOIN_OPENS_MINUTES} min before`}
        </span>
      );
    case "pending":
      return (
        <span className={cn("text-sm", onBlock ? "text-block-foreground/75" : "text-muted-foreground")}>
          Joining details {JOIN_OPENS_MINUTES} min before
        </span>
      );
    default:
      return null;
  }
}

export function RecordingAction({ recording }: { recording: Recording | null }) {
  if (!recording) {
    return <span className="text-sm text-muted-foreground">Recording to follow</span>;
  }
  return (
    <ButtonLink
      href={recording.url}
      target="_blank"
      rel="noopener noreferrer"
      variant="outline"
      size="sm"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true" className="h-2.5 w-2.5">
        <path d="M3 2v8l7-4z" fill="currentColor" />
      </svg>
      Watch recording
    </ButtonLink>
  );
}

/** Day and month in a small red-on-paper block — static decoration is red (note 10 §5). */
export function DateBadge({
  value,
  large = false,
  filled = false,
}: {
  value: string;
  large?: boolean;
  /** Solid red with white text (the "white on red" rule), for a noir panel. */
  filled?: boolean;
}) {
  const { day, month } = dateBadge(value);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-(--radius)",
        large ? "h-16 w-16" : "h-12 w-12",
        filled ? "bg-button text-button-foreground" : "bg-primary/10 text-primary",
      )}
    >
      <span className="text-[0.625rem] font-semibold tracking-wide uppercase">{month}</span>
      <span className="text-lg leading-none font-semibold">{day}</span>
    </span>
  );
}
