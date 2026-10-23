import { KIND_ICON } from "@/components/account/AccessCard";
import { StatusPill } from "@/components/account/StatusPill";
import { ButtonLink } from "@/components/ui/Button";
import { IconTile } from "@/components/ui/Icon";
import type { AccessItem } from "@/lib/account/access";
import { formatDate, formatDateTime } from "@/lib/account/format";
import { cn } from "@/lib/utils/cn";

/**
 * One thing the customer can use, as a ROW across the page — the same four
 * questions `AccessCard` answers (what it is, where it came from, how much is
 * left, when it ends) and the one action that uses it.
 *
 * Owner, 2026-10-09: the cards "restructured better, maybe to use the whole
 * width, or appear like the bookings page". A grid of two tall cards put each
 * item's facts in a narrow column and its button at the very bottom; a list
 * of rows reads left to right — what it is, its facts, the action — and a
 * page of them scans down one edge, as Bookings does.
 *
 *   top      the type icon, the kind, the title and the one-line summary on the
 *            left; the action, or how it ended, on the right
 *   below    its facts under a rule, each in its own column
 *
 * `AccessCard`, the two-column card this replaced, is unchanged and still
 * exported; the two pages that list access choose between the two components.
 */
export function AccessRow({
  item,
  showKind = true,
}: {
  item: AccessItem;
  /** Off where the row sits under a heading that already names its kind. */
  showKind?: boolean;
}) {
  const ended = item.state === "ended";
  const left = item.credits ? item.credits.total - item.credits.used : null;

  const facts: Array<{ label: string; value: string }> = [];
  if (item.when) {
    facts.push({
      label: item.whenLabel ?? (item.resourceType === "event" ? "Date" : "Starts"),
      value: formatDateTime(item.when),
    });
  }
  // A booked or finished session is said by its own date; a second "access
  // until" beside it would only repeat or contradict it.
  if (!(item.whenLabel && !item.expiresAt) && item.whenLabel !== "Took place") {
    facts.push({
      label: item.endLabel ?? (ended ? "Ended" : "Access until"),
      value: item.expiresAt
        ? formatDate(item.expiresAt)
        : ended
          ? "—"
          : item.resourceType === "event"
            ? "The event"
            : "No end date",
    });
  }
  facts.push({ label: "How you got it", value: item.source });

  return (
    <article
      className={cn(
        "rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6",
        ended && "bg-transparent shadow-none",
      )}
    >
      {/* What it is, with the one action beside it. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex min-w-0 items-center gap-4">
          <IconTile name={KIND_ICON[item.resourceType] ?? "key"} tone={ended ? "neutral" : "accent"} />
          <div className="min-w-0">
            {showKind ? (
              <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{item.kind}</p>
            ) : null}
            <h3 className={cn(showKind && "mt-1", "text-lg leading-snug font-semibold text-pretty", ended && "text-muted-foreground")}>
              {item.title}
            </h3>
            {item.summary ? <p className="mt-1.5 text-sm font-medium text-accent">{item.summary}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 pl-14 sm:pl-0">
          {ended && item.endedReason ? <StatusPill>{item.endedReason}</StatusPill> : null}
          {item.href && item.actionLabel ? (
            <ButtonLink href={item.href} size="sm" variant={ended ? "outline" : "primary"}>
              {item.actionLabel}
            </ButtonLink>
          ) : null}
        </div>
      </div>

      {/*
        Its facts, on their own line under a rule, each in a column of its own
        (owner, 2026-10-09: "it should not be congested"). Beside the title
        they were squeezed into a third of the row and wrapped onto two lines;
        here every row's facts sit in the same columns, with room. They start
        at the title's text, not under the icon.
      */}
      <dl className="mt-5 grid grid-cols-2 gap-x-10 gap-y-5 border-t border-border pt-5 text-sm sm:ml-14 sm:grid-cols-3">
        {facts.map((fact) => (
          <div key={fact.label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="mt-1 font-medium text-pretty">{fact.value}</dd>
          </div>
        ))}

        {/* A meter of sessions is for a pack; for one session it only says "1 of 1". */}
        {item.credits && left != null && item.credits.total > 1 ? (
          <div className="col-span-2 sm:col-span-3">
            <div className="flex max-w-sm items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Still to book</span>
              <span className="font-medium tabular-nums">
                {left} of {item.credits.total}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Sessions still to book"
              aria-valuemin={0}
              aria-valuemax={item.credits.total}
              aria-valuenow={left}
              className="mt-2 h-1.5 max-w-sm overflow-hidden rounded-full bg-surface-muted"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-(--dur-slow) ease-expo"
                style={{ width: `${item.credits.total ? (left / item.credits.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : null}
      </dl>
    </article>
  );
}
