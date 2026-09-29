"use client";

import { useActionState, useEffect, useId } from "react";

import { subscribeAction } from "@/app/(public)/newsletter/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  NEWSLETTER_CONSENT_TEXT,
  type NewsletterFormState,
} from "@/lib/validation/newsletter-copy";

/**
 * Newsletter opt-in — note 04 §8, note 10 §23.
 *
 * THE CONSENT BOX IS UNTICKED AND REQUIRED. A pre-ticked box is not valid
 * consent under UK GDPR, and defaulting it to checked would invalidate every
 * signup collected through it — so it is not a styling choice.
 *
 * `variant` only changes the layout. The consent wording, the required box and
 * the honeypot are identical wherever it appears, because they are what makes
 * the signup lawful.
 *
 * `compact` is the footer's single line (note 10 §42.2): a small label, a
 * boxed field with a filled button beside it, and the consent and privacy
 * wording in small print — the same form, a quarter of the height.
 */
export function NewsletterSignup({
  variant = "inline",
  heading = "Stay in touch",
  description = "Occasional news about coaching, courses, books and films. No more than a few times a year.",
  onSubscribed,
}: {
  variant?: "inline" | "footer" | "compact";
  heading?: string;
  description?: string;
  /** Told once a signup succeeds — the popup uses it to stop asking. */
  onSubscribed?: () => void;
}) {
  const [state, formAction] = useActionState<NewsletterFormState, FormData>(
    subscribeAction,
    {},
  );
  const emailId = useId();
  const consentId = useId();

  useEffect(() => {
    if (state.success) onSubscribed?.();
  }, [state.success, onSubscribed]);

  if (state.success) {
    return (
      <div
        role="status"
        className={
          variant !== "inline"
            ? "text-sm text-muted-foreground"
            : "rounded-(--radius) border border-success bg-success/10 p-6"
        }
      >
        {state.success}
      </div>
    );
  }

  const isFooter = variant === "footer";

  if (variant === "compact") {
    return (
      <form action={formAction} noValidate>
        <label
          htmlFor={emailId}
          className="block text-[0.6875rem] font-semibold tracking-[0.24em] text-muted-foreground uppercase"
        >
          {heading}
        </label>

        {state.error ? (
          <p role="alert" className="mt-3 text-sm text-error">
            {state.error}
          </p>
        ) : null}

        {/* A real, boxed field with the button beside it, not inside it — an
            underline alone was too faint on the ink footer to read as
            somewhere to type. Stacked on phones, where side by side would
            squeeze the field. */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="Email address"
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            aria-describedby={state.fieldErrors?.email ? `${emailId}-error` : undefined}
            className="h-11 w-full min-w-0 rounded-sm border border-input-border bg-background px-4 sm:flex-1 text-base text-foreground transition-colors placeholder:text-foreground/60 focus-visible:border-foreground focus-visible:outline-none"
          />
          <SubmitButton className="h-11 shrink-0 px-5 text-sm">
            Subscribe &rarr;
          </SubmitButton>
        </div>
        {state.fieldErrors?.email ? (
          <p id={`${emailId}-error`} className="mt-2 text-sm text-error">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}

        <div className="mt-3 flex gap-2.5">
          <input
            id={consentId}
            name="consent"
            type="checkbox"
            // NOT defaultChecked — a legal requirement, see above.
            required
            aria-describedby={state.fieldErrors?.consent ? `${consentId}-error` : undefined}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input-border accent-accent"
          />
          <label htmlFor={consentId} className="text-[0.75rem] leading-relaxed text-muted-foreground">
            {NEWSLETTER_CONSENT_TEXT} We never share your address —{" "}
            <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              privacy notice
            </a>
            .
          </label>
        </div>
        {state.fieldErrors?.consent ? (
          <p id={`${consentId}-error`} className="mt-2 text-sm text-error">
            {state.fieldErrors.consent[0]}
          </p>
        ) : null}

        {/* Honeypot — hidden from people and from assistive technology. */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${emailId}-website`}>Leave this field empty</label>
          <input id={`${emailId}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
      </form>
    );
  }

  return (
    <div
      className={
        isFooter
          ? "grid gap-6 lg:grid-cols-2 lg:items-start lg:gap-12"
          : "rounded-(--radius-lg) border border-border bg-surface p-6 shadow-card sm:p-8"
      }
    >
      <div>
        <h3
          className={
            isFooter
              ? "font-display text-2xl font-semibold text-balance"
              : "font-display text-xl font-semibold"
          }
        >
          {heading}
        </h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <form action={formAction} className="space-y-3" noValidate>
        {state.error ? (
          <p
            role="alert"
            className="rounded-(--radius) border border-error bg-error/10 px-3 py-2 text-sm text-error"
          >
            {state.error}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor={emailId} className="sr-only">
            Email address
          </label>
          <div className="sm:flex sm:gap-2">
            <input
              id={emailId}
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={state.fieldErrors?.email ? true : undefined}
              aria-describedby={
                state.fieldErrors?.email ? `${emailId}-error` : undefined
              }
              className="h-11 w-full rounded-(--radius) border border-input-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:flex-1"
            />
            <SubmitButton className="mt-2 w-full sm:mt-0 sm:w-auto">
              Subscribe
            </SubmitButton>
          </div>
          {state.fieldErrors?.email ? (
            <p id={`${emailId}-error`} className="text-sm text-error">
              {state.fieldErrors.email[0]}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2.5">
          <input
            id={consentId}
            name="consent"
            type="checkbox"
            // NOT defaultChecked. See the note above — this is a legal
            // requirement, not a preference.
            required
            aria-describedby={
              state.fieldErrors?.consent ? `${consentId}-error` : undefined
            }
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-input-border accent-accent"
          />
          <label htmlFor={consentId} className="text-xs text-muted-foreground">
            {NEWSLETTER_CONSENT_TEXT}
          </label>
        </div>
        {state.fieldErrors?.consent ? (
          <p id={`${consentId}-error`} className="text-sm text-error">
            {state.fieldErrors.consent[0]}
          </p>
        ) : null}

        {/* Honeypot — hidden from people and from assistive technology. */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor={`${emailId}-website`}>Leave this field empty</label>
          <input
            id={`${emailId}-website`}
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          We never share your address. See our{" "}
          <a href="/privacy" className="underline underline-offset-4">
            privacy notice
          </a>
          .
        </p>
      </form>
    </div>
  );
}
