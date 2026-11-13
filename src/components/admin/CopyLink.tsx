"use client";

import { useState } from "react";

/**
 * A personal joining link for staff to pass on (owner, 2026-11-13). Copied,
 * never opened: following someone's own Zoom link would join the meeting as
 * them, and as each link works on one device at a time it could push the real
 * person out.
 */
export function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  let short = url;
  try {
    const parsed = new URL(url);
    short = `${parsed.host}${parsed.pathname}`;
  } catch {
    // Not a web address: shown as it is.
  }

  return (
    <span className="inline-flex max-w-full items-center gap-2">
      <span title={url} className="min-w-0 truncate font-mono text-xs text-muted-foreground">
        {short}…
      </span>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="shrink-0 rounded-full border border-input-border px-3 py-1 text-xs font-semibold transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
      >
        <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
      </button>
    </span>
  );
}
