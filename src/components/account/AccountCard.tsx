import type { ReactNode } from "react";

import { IconTile, type IconName } from "@/components/ui/Icon";

/**
 * The Account area's panel: a title, a line saying what it is for, an
 * optional status on the right, a rule, then its content. Security, Profile
 * and Billing share it so the three read as one set of pages. An `icon` leads
 * the title in a round tile, as the Security page's cards do.
 */
export function AccountCard({
  title,
  description,
  status,
  children,
  id,
  icon,
}: {
  title: string;
  description?: string;
  status?: ReactNode;
  children: ReactNode;
  id?: string;
  icon?: IconName;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className="scroll-mt-24 rounded-(--radius-lg) border border-border bg-surface p-5 shadow-card sm:p-6"
    >
      <div className={icon ? "flex flex-col items-start gap-3 sm:flex-row sm:gap-4" : "flex flex-wrap items-start gap-4"}>
        {icon ? <IconTile name={icon} tone="accent" size="lg" /> : null}
        <div className="min-w-0 flex-1">
          <h2 id={id ? `${id}-title` : undefined} className="font-display text-lg font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {status}
      </div>
      {/* With an icon, the body lines up with the title, not the tile. */}
      <div className={icon ? "mt-4 border-t border-border pt-5 sm:ml-16" : "mt-4 border-t border-border pt-5"}>
        {children}
      </div>
    </section>
  );
}
