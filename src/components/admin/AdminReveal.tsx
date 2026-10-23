"use client";

import { useState, type ReactNode } from "react";

import { AdminCard } from "@/components/admin/AdminForm";
import { Button } from "@/components/ui/Button";

/**
 * A form kept behind a button until it is wanted — note 10 §32.1.
 *
 * AN ADMIN PAGE OPENS ON ITS LIST (owner, 2026-10-13). People come to a page
 * to look something up far more often than to add to it, and a form left open
 * above the list pushes what they came for down the page every time. So a
 * form that creates or grants something is one button; pressing it opens the
 * form as a card, and Close puts it away again.
 *
 * Closed, it is only the button, so it can sit at the end of a toolbar row.
 * Open, it takes the full width, which in a wrapping row drops it onto a line
 * of its own. The form stays mounted while open, so its own success or error
 * message is not lost.
 */
export function AdminReveal({
  label,
  title,
  description,
  children,
}: {
  /** The button, and what it says. */
  label: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }

  return (
    <AdminCard className="w-full">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {children}
    </AdminCard>
  );
}
