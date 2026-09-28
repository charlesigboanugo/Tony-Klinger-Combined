import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The small tracked-caps label above a heading — note 10 §9.
 *
 * RED IS THE DASH, NOT THE WORDS (owner, 2026-09-26): the label itself is set
 * in the surrounding text colour at 70%, and the site red appears only as the
 * hairline dash before it — and after it too when the label is centred, so
 * the pair frames it. Taking the colour from `currentColor` rather than a
 * token means the same label reads on the page ground and on a noir band
 * without a tone prop.
 */
export function Eyebrow({
  children,
  align = "start",
  as: Tag = "p",
  id,
  className,
}: {
  children: ReactNode;
  /** "center" puts a dash on both sides. */
  align?: "start" | "center" | "end";
  as?: ElementType;
  id?: string;
  className?: string;
}) {
  const dash = <span aria-hidden="true" className="h-px w-10 shrink-0 bg-primary" />;
  return (
    <Tag
      id={id}
      className={cn(
        "flex items-center gap-4 text-xs font-semibold tracking-[0.2em] text-current/70 uppercase",
        align === "center" && "justify-center",
        align === "end" && "justify-end",
        className,
      )}
    >
      {align !== "end" ? dash : null}
      {children}
      {align !== "start" ? dash : null}
    </Tag>
  );
}
