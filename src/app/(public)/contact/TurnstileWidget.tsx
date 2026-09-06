"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

/**
 * Turnstile widget, explicitly rendered — note 05 §35.
 *
 * WHY NOT THE `cf-turnstile` CLASS. The implicit form scans the DOM once and
 * renders whatever it finds, which does not survive React. Two things break:
 *
 *   1. A TOKEN IS SINGLE-USE and expires after 300 seconds. After a rejected
 *      submission — a validation error, the rate limit — the form re-renders
 *      with the SAME consumed token, so every retry fails the captcha and the
 *      visitor is stuck with "the security check did not pass" no matter what
 *      they correct. The widget has to be reset between attempts.
 *   2. When React unmounts the container, Turnstile keeps its own reference to
 *      the removed node and logs "Cannot find Widget cf-chl-widget-…".
 *
 * Explicit rendering fixes both: we hold the widget id, reset it after a failed
 * submission, and remove it on unmount.
 */
type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: Record<string, unknown>,
  ) => string | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({
  siteKey,
  /**
   * Identity changes only when a submission actually CONSUMED the token.
   *
   * Resetting on every rejected submission was a bug: a validation error or the
   * rate limit never reaches Turnstile, so the token was still good — throwing
   * it away left the widget re-solving, and a prompt retry submitted an empty
   * token and failed for a reason the visitor could not see.
   */
  resetKey,
  /** Reports whether a usable token exists, so the form can block submission. */
  onTokenChange,
}: {
  siteKey: string;
  resetKey: unknown;
  onTokenChange?: (hasToken: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);

  // Held in a ref so the render effect below does not re-run — and re-render the
  // widget — every time the parent passes a new function identity. Assigned in
  // an effect rather than during render: a render may be discarded, and writing
  // a ref from one is a side effect React does not guarantee.
  const notifyRef = useRef(onTokenChange);
  useEffect(() => {
    notifyRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!scriptReady || !containerRef.current || widgetIdRef.current) return;

    const api = window.turnstile;
    if (!api) return;

    widgetIdRef.current =
      api.render(containerRef.current, {
        sitekey: siteKey,
        // 100% of the container, minimum 300px, 65px tall.
        size: "flexible",
        // Follows the visitor's light/dark setting rather than pinning one.
        theme: "auto",
        // Fires when the challenge is solved and a token is available.
        callback: () => notifyRef.current?.(true),
        // A token left sitting on a slowly-filled form goes stale after five
        // minutes; refresh it in place rather than failing on submit.
        "expired-callback": () => {
          notifyRef.current?.(false);
          if (widgetIdRef.current) api.reset(widgetIdRef.current);
        },
        "error-callback": () => notifyRef.current?.(false),
      }) ?? null;

    return () => {
      if (widgetIdRef.current) {
        // Removes the widget AND Turnstile's internal reference to it, which is
        // what the "Cannot find Widget" warning is complaining about.
        api.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [scriptReady, siteKey]);

  useEffect(() => {
    // Skipped on first render: there is nothing to reset before the first
    // submission, and resetting a freshly-rendered widget throws away a token
    // the visitor may have already solved.
    if (!widgetIdRef.current) return;
    notifyRef.current?.(false);
    window.turnstile?.reset(widgetIdRef.current);
  }, [resetKey]);

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      {/*
        The 300px floor cannot shrink further, so on a very narrow viewport the
        widget scrolls inside its own box rather than widening the page and
        dragging every other element into a horizontal scroll.
      */}
      <div className="max-w-full overflow-x-auto">
        <div ref={containerRef} />
      </div>
    </>
  );
}
