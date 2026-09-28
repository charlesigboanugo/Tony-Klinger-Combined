import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Admin table — note 10 §32, §33.
 *
 * Denser than public pages, but built from the same tokens. Scrolls
 * horizontally on small screens rather than crushing columns into
 * illegibility.
 */
export function AdminTable({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-(--radius-lg) border border-border bg-surface shadow-card">
      <table className="w-full min-w-xl text-sm">
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="px-4 py-3 text-left text-[0.6875rem] font-semibold tracking-widest text-muted-foreground uppercase"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}

/**
 * Status pill.
 *
 * Colour is a SECOND signal, never the only one — the word is always present,
 * so the meaning survives for anyone who cannot distinguish the hues (note 10
 * §21). Unknown statuses fall back to the neutral treatment rather than
 * guessing at a colour.
 */
const TONES: Record<string, string> = {
  paid: "border-success/40 bg-success/10 text-success",
  active: "border-success/40 bg-success/10 text-success",
  published: "border-success/40 bg-success/10 text-success",
  confirmed: "border-success/40 bg-success/10 text-success",
  completed: "border-success/40 bg-success/10 text-success",
  sent: "border-success/40 bg-success/10 text-success",
  succeeded: "border-success/40 bg-success/10 text-success",
  pending: "border-warning/40 bg-warning/10 text-warning",
  processing: "border-warning/40 bg-warning/10 text-warning",
  paused: "border-warning/40 bg-warning/10 text-warning",
  past_due: "border-warning/40 bg-warning/10 text-warning",
  draft: "border-border bg-surface-muted text-muted-foreground",
  failed: "border-error/40 bg-error/10 text-error",
  cancelled: "border-error/40 bg-error/10 text-error",
  expired: "border-error/40 bg-error/10 text-error",
  refunded: "border-error/40 bg-error/10 text-error",
  no_show: "border-error/40 bg-error/10 text-error",
  revoked: "border-error/40 bg-error/10 text-error",
  archived: "border-border bg-surface-muted text-muted-foreground",
};

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize",
        TONES[value] ?? "border-border bg-surface-muted text-muted-foreground",
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}
