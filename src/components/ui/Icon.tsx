import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * The workspace icon set — note 10 (iconography).
 *
 * One stroke family (24px grid, 1.7 stroke, round caps and joins), the same
 * drawing style the Account, Academy and Admin navigations already use, so an
 * icon in a card and the icon beside the same area in the sidebar match.
 * Decorative by default: every icon sits beside words that carry the meaning.
 */
const PATHS = {
  key: (
    <>
      <circle cx="8" cy="12" r="3.5" />
      <path d="M11.5 12H21M17 12v3M20 12v2" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  desktop: (
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16.5V20" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M11 18h2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M15 14.5c2.8 0 5 1.3 5 4.5" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10v4h3l7 4V6L7 10z" />
      <path d="M17.5 9a4 4 0 0 1 0 6M7 14l1.5 5.5" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  card: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 11.1a2 2 0 0 1-2 1.9H8.2a2 2 0 0 1-2-1.9L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  ticket: (
    <>
      <path d="M3.5 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4V18h17v-2a2 2 0 0 1 0-4 2 2 0 0 1 0-4V6h-17z" />
      <path d="M14 6v12" strokeDasharray="2 2" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  play: (
    <>
      <rect x="3" y="5" width="18" height="13" rx="2" />
      <path d="m10 9 5 2.5-5 2.5z" />
    </>
  ),
  chat: (
    <>
      <path d="M4 5h16v10H9l-5 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="8" cy="17" r="2" />
    </>
  ),
  pound: (
    <>
      <path d="M16 6.5A3.5 3.5 0 0 0 9.5 8v4.5c0 3-1 5-3 6h11" />
      <path d="M7 12.5h7" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  pencil: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.3 3.5 5.3 3.5 8.5s-1 6.2-3.5 8.5c-2.5-2.3-3.5-5.3-3.5-8.5s1-6.2 3.5-8.5Z" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v4M15 3v4M6.5 7h11v3.5a5.5 5.5 0 0 1-11 0z" />
      <path d="M12 16v5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1v.5M12 16.5h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19.5H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
      <path d="M4 4v4.5h4.5M12 8v4l2.5 2" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
      <path d="M10 12h10M17 8.5 20.5 12 17 15.5" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-5 w-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}

const TONES = {
  neutral: "border-border bg-surface-muted text-muted-foreground",
  accent: "border-accent/35 bg-accent/10 text-accent",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  error: "border-error/35 bg-error/10 text-error",
  brand: "border-primary/30 bg-primary/10 text-primary",
} as const;

export type IconTone = keyof typeof TONES;

/**
 * An icon in a round tile — the leading mark of a row or card (a device, a
 * key, a setting). The tone carries state where there is one: accent for
 * "this / current", success for on, warning for needs attention.
 */
export function IconTile({
  name,
  tone = "neutral",
  size = "md",
  className,
}: {
  name: IconName;
  tone?: IconTone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const box = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" }[size];
  const glyph = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-6 w-6" }[size];
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-full border", box, TONES[tone], className)}
    >
      <Icon name={name} className={glyph} />
    </span>
  );
}
