"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

/**
 * Error boundary — note 10 §23, note 05 §35.
 *
 * Without this, an unhandled render error shows Next's default screen, which in
 * production is a bare "Application error" and in development leaks a stack
 * trace. Neither is acceptable on a customer-facing page.
 *
 * THE MESSAGE IS NEVER SHOWN TO THE VISITOR. An error can carry a database
 * constraint name, a file path or part of a query — detail that helps an
 * attacker and means nothing to a customer. It goes to the server log instead,
 * where `digest` ties it back to the real error (note 05 §35).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("unhandled error", { digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-muted-foreground">
        The page could not be loaded. This has been logged and we are looking at
        it.
      </p>

      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-(--radius) border border-border px-5 hover:bg-surface-muted"
        >
          Go home
        </Link>
      </div>

      {/* Support can quote this back; it identifies the log entry without
          revealing anything about what failed. */}
      {error.digest ? (
        <p className="mt-6 text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
