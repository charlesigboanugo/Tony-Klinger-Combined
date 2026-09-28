"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { NewsletterSignup } from "@/components/content/NewsletterSignup";
import { Button, ButtonArrow, type ButtonVariant } from "@/components/ui/Button";
import { Wordmark } from "@/components/navigation/Wordmark";

/**
 * Newsletter popup — note 04 §8, note 10 §23, §37.
 *
 * Replaces the full signup form that made the footer too tall (owner,
 * 2026-09-24). The footer now carries one line and a button that opens this;
 * the same dialog also offers itself ONCE to a visitor who is clearly reading.
 *
 * WHEN IT OPENS BY ITSELF — all of:
 *   - at least 25 seconds on the page AND half of it scrolled: a reader, not
 *     someone who just landed;
 *   - not on checkout, cart or sign-in pages, where it would get in the way
 *     of the thing the visitor came to do;
 *   - never for someone who subscribed in this browser, and not again for 30
 *     days after it was closed.
 *
 * WHY LOCAL STORAGE, NOT THE SERVER. Subscription lives with the email
 * provider and is keyed by address, and an anonymous visitor has no address
 * until they type one — so the browser is the only place that can remember
 * "this person already said yes / already said no". A cookie would be sent
 * to the server on every request for no reason. If storage is unavailable
 * (private mode, blocked), it simply never opens by itself; the footer button
 * still works.
 *
 * It is a native `<dialog>` opened with `showModal()`, so focus is trapped,
 * Escape closes it and the page behind is inert without any code of ours. It
 * animates in AND out (the dropdown standard, §37.1): the element stays open
 * while `data-open` flips, and only closes once the fade has finished.
 */

const STORAGE_KEY = "tk-newsletter";
const OPEN_EVENT = "tk:open-newsletter";
const SNOOZE_DAYS = 30;
const MIN_SECONDS = 25;
const MIN_SCROLL = 0.5;
const CLOSE_MS = 240;
const QUIET_PATHS = ["/checkout", "/cart", "/auth", "/welcome"];

type Stored = { state: "subscribed" } | { state: "dismissed"; at: number };

function read(): Stored | null | undefined {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return undefined; // storage unavailable — treat as "do not auto-open"
  }
}

function write(value: Stored) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* Nothing to do: the popup just may offer itself again. */
  }
}

/** Opens the popup from anywhere — the footer button uses this. */
export function openNewsletter() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function NewsletterPopup() {
  const dialog = useRef<HTMLDialogElement | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const show = useCallback(() => {
    const el = dialog.current;
    if (!el || el.open) return;
    el.showModal();
    // Next frame, so the closed styles are painted first and the transition
    // has something to run from.
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const hide = useCallback((remember: boolean) => {
    const el = dialog.current;
    if (!el?.open) return;
    if (remember && read()?.state !== "subscribed") write({ state: "dismissed", at: Date.now() });
    setOpen(false);
    window.setTimeout(() => el.close(), CLOSE_MS);
  }, []);

  // Manual opening, from the footer or anywhere else.
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [show]);

  // Escape: take over the native close so it animates out and is remembered.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      hide(true);
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [hide]);

  // Opening by itself — once, to a reader, on a page where it will not intrude.
  useEffect(() => {
    if (QUIET_PATHS.some((p) => pathname.startsWith(p))) return;
    const stored = read();
    if (stored === undefined || stored?.state === "subscribed") return;
    if (stored?.state === "dismissed" && Date.now() - stored.at < SNOOZE_DAYS * 864e5) return;

    let seconds = false;
    let scrolled = false;
    const maybeOpen = () => {
      if (seconds && scrolled) {
        cleanup();
        show();
      }
    };
    const timer = window.setTimeout(() => {
      seconds = true;
      maybeOpen();
    }, MIN_SECONDS * 1000);
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= MIN_SCROLL) {
        scrolled = true;
        maybeOpen();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }
    return cleanup;
  }, [pathname, show]);

  const onSubscribed = useCallback(() => write({ state: "subscribed" }), []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="newsletter-popup-title"
      data-open={open}
      // Clicking the backdrop (the dialog element itself, outside the panel)
      // closes it, as people expect of a popup.
      onClick={(e) => {
        if (e.target === e.currentTarget) hide(true);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl bg-transparent p-0 backdrop:bg-black/0 backdrop:transition-[background-color] backdrop:duration-(--dur-base) data-[open=true]:backdrop:bg-black/60"
    >
      <div className="on-ink grain relative isolate overflow-hidden rounded-sm p-7 opacity-0 shadow-lift ring-1 ring-white/12 transition-[opacity,transform] duration-(--dur-menu-in) ease-(--ease-in-out-menu) scale-95 in-data-[open=true]:scale-100 in-data-[open=true]:opacity-100 sm:p-10">
        <button
          type="button"
          onClick={() => hide(true)}
          aria-label="Close"
          className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full text-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>

        <Wordmark />
        <h2
          id="newsletter-popup-title"
          className="mt-8 font-display"
        >
          Letters from Tony.
        </h2>
        <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
          Stories from six decades on set, new courses and coaching dates, and
          the occasional book or film — a few times a year, never more.
        </p>

        <div className="mt-8">
          <NewsletterSignup variant="compact" heading="Your email" onSubscribed={onSubscribed} />
        </div>
      </div>
    </dialog>
  );
}

/** The footer's one-line invitation — opens the popup. */
export function NewsletterButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={openNewsletter} className={className}>
      Get letters from Tony &rarr;
    </button>
  );
}

/**
 * The same invitation as a full button, for pages that offer the letters
 * inline. There is no /newsletter page — sign-up lives in this popup.
 */
export function NewsletterCta({ variant = "outline" }: { variant?: ButtonVariant }) {
  return (
    <Button type="button" variant={variant} onClick={openNewsletter}>
      Get letters from Tony
      <ButtonArrow />
    </Button>
  );
}
