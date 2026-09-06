import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Page width container — note 10 §11.
 *
 * Content width is centralized here so pages do not each invent their own.
 */
export function Container({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "wide" | "narrow";
}) {
  const widths = {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-[90rem]",
  } as const;

  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", widths[width], className)}>
      {children}
    </div>
  );
}

/** Vertical rhythm for page sections — note 10 §10. */
export function Section({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn("py-12 sm:py-16", className)}>{children}</section>;
}
