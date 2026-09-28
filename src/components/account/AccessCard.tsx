import { StatusPill } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile, type IconName } from "@/components/ui/Icon";
import type { AccessItem } from "@/lib/account/access";
import { formatDate, formatDateTime } from "@/lib/account/format";
import { cn } from "@/lib/utils/cn";

/**
 * One thing the customer can use — note 01 §28's four questions answered on
 * the card itself: what it is, where it came from, how much is left, and when
 * it ends. Plus the one action that uses it.
 *
 * Three bands, top to bottom (owner, 2026-09-27: the earlier arrangement
 * scattered label/value pairs in two ragged columns):
 *
 *   heading   the type icon beside a two-line heading — kind, then title
 *   facts     one row per fact, label left and value right, on hairlines,
 *             so every card reads down the same column whatever its content
 *   footer    the action, on its own rule at the bottom of the card
 *
 * Everything under the heading starts at the heading's text, not the icon.
 */
const KIND_ICON: Record<string, IconName> = {
  course: "play",
  masterclass: "play",
  group_coaching_series: "chat",
  group_coaching_session: "chat",
  cohort: "users",
  private_coaching: "user",
  event: "ticket",
  retreat: "globe",
  resource: "receipt",
  release: "receipt",
  partner_discount: "star",
};

export function AccessCard({ item }: { item: AccessItem }) {
  const ended = item.state === "ended";
  const left = item.credits ? item.credits.total - item.credits.used : null;

  const facts: Array<{ label: string; value: string }> = [];
  if (item.when) facts.push({ label: item.resourceType === "event" ? "Date" : "Starts", value: formatDateTime(item.when) });
  facts.push({
    label: ended ? "Ended" : "Access until",
    value: item.expiresAt
      ? formatDate(item.expiresAt)
      : ended
        ? "—"
        : item.resourceType === "event"
          ? "The event"
          : "No end date",
  });
  facts.push({ label: "How you got it", value: item.source });

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-(--radius-lg) border border-border bg-surface shadow-card",
        ended && "bg-transparent shadow-none",
      )}
    >
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <IconTile name={KIND_ICON[item.resourceType] ?? "key"} tone={ended ? "neutral" : "accent"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{item.kind}</p>
              {ended ? <StatusPill>{item.endedReason}</StatusPill> : null}
            </div>
            <h3 className={cn("mt-1 text-lg leading-snug font-semibold text-pretty", ended && "text-muted-foreground")}>
              {item.title}
            </h3>
          </div>
        </div>

        <div className="mt-4 pl-13">
          <dl className="divide-y divide-border border-y border-border text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="shrink-0 text-muted-foreground">{fact.label}</dt>
                <dd className="text-right font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>

          {item.credits && left != null ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Sessions left</span>
                <span className="font-medium tabular-nums">
                  {left} of {item.credits.total}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Sessions left"
                aria-valuemin={0}
                aria-valuemax={item.credits.total}
                aria-valuenow={left}
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"
              >
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-(--dur-slow) ease-expo"
                  style={{ width: `${item.credits.total ? (left / item.credits.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {item.href && item.actionLabel ? (
        <div className="border-t border-border px-5 py-4 sm:px-6">
          <div className="pl-13">
            <ButtonLink href={item.href} size="sm" variant={ended ? "outline" : "primary"}>
              {item.actionLabel}
            </ButtonLink>
          </div>
        </div>
      ) : null}
    </article>
  );
}
