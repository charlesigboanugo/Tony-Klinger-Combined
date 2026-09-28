import { cn } from "@/lib/utils/cn";

/**
 * A state label — word first, colour second (note 10 §21): the text always
 * says the state, so the tint is never the only signal.
 */
export type PillTone = "good" | "warn" | "bad" | "neutral";

const TONES: Record<PillTone, string> = {
  good: "border-success/40 bg-success/10 text-success",
  warn: "border-warning/40 bg-warning/10 text-warning",
  bad: "border-error/40 bg-error/10 text-error",
  neutral: "border-border bg-surface-muted text-muted-foreground",
};

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Order and subscription statuses, in words a customer would use. */
export const ORDER_STATUS: Record<string, { label: string; tone: PillTone }> = {
  paid: { label: "Paid", tone: "good" },
  pending: { label: "Awaiting payment", tone: "warn" },
  processing: { label: "Processing", tone: "warn" },
  failed: { label: "Payment failed", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: PillTone }> = {
  active: { label: "Active", tone: "good" },
  trialing: { label: "Trial", tone: "good" },
  past_due: { label: "Payment overdue", tone: "warn" },
  unpaid: { label: "Unpaid", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  incomplete: { label: "Incomplete", tone: "warn" },
  expired: { label: "Ended", tone: "neutral" },
};

export function statusOf(
  map: Record<string, { label: string; tone: PillTone }>,
  status: string,
) {
  return map[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as const };
}
