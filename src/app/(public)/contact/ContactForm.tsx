"use client";

import { useActionState, useCallback, useId, useState } from "react";

import { submitContactAction } from "@/app/(public)/contact/actions";
import { TurnstileWidget } from "@/app/(public)/contact/TurnstileWidget";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ContactFormState } from "@/lib/validation/contact";

/**
 * Contact form — note 03 §8, note 10 §23.
 *
 * A progressively-enhanced Server Action form: the fields are real inputs in a
 * real <form>, so validation and submission are server-side and the markup is
 * meaningful before any JavaScript runs. Turnstile is the one part that
 * genuinely needs the client.
 */
export function ContactForm({ siteKey }: { siteKey?: string }) {
  const [state, formAction] = useActionState<ContactFormState, FormData>(
    submitContactAction,
    {},
  );

  // Blocks submission until Turnstile has produced a token. Without this, a
  // quick submit lands while the widget is still solving, sends nothing, and is
  // rejected for a reason the visitor cannot see or act on.
  const [hasToken, setHasToken] = useState(false);
  const handleToken = useCallback((value: boolean) => setHasToken(value), []);
  const ids = {
    name: useId(),
    email: useId(),
    subject: useId(),
    message: useId(),
    status: useId(),
  };

  if (state.success) {
    return (
      <div
        // Announced to a screen reader, which would otherwise get no indication
        // that the form had been replaced by a confirmation.
        role="status"
        className="rounded-(--radius) border border-success bg-success/10 p-6"
      >
        <h2 className="font-medium">Message sent</h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.success}</p>
      </div>
    );
  }

  return (
    <>
      <form action={formAction} className="space-y-5" noValidate>
        {state.error ? (
          <p
            id={ids.status}
            role="alert"
            className="rounded-(--radius) border border-error bg-error/10 px-3 py-2 text-sm text-error"
          >
            {state.error}
          </p>
        ) : null}

        <Field
          id={ids.name}
          name="name"
          label="Your name"
          defaultValue={state.values?.name}
          errors={state.fieldErrors?.name}
          autoComplete="name"
          required
        />

        <Field
          id={ids.email}
          name="email"
          type="email"
          label="Email address"
          defaultValue={state.values?.email}
          errors={state.fieldErrors?.email}
          autoComplete="email"
          required
        />

        <Field
          id={ids.subject}
          name="subject"
          label="Subject"
          hint="Optional"
          defaultValue={state.values?.subject}
          errors={state.fieldErrors?.subject}
        />

        <div className="space-y-1.5">
          <label htmlFor={ids.message} className="block text-sm font-medium">
            Message
          </label>
          <textarea
            id={ids.message}
            name="message"
            rows={7}
            required
            defaultValue={state.values?.message}
            aria-invalid={state.fieldErrors?.message ? true : undefined}
            aria-describedby={
              state.fieldErrors?.message ? `${ids.message}-error` : undefined
            }
            className="w-full rounded-(--radius) border border-input-border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {state.fieldErrors?.message ? (
            <p id={`${ids.message}-error`} className="text-sm text-error">
              {state.fieldErrors.message[0]}
            </p>
          ) : null}
        </div>

        {/*
          Honeypot. Hidden from people but present in the DOM, because a bot
          fills every field it finds. `aria-hidden` and `tabIndex={-1}` keep it
          away from screen readers and the tab order — a hidden field a
          keyboard user can land in is a trap that silently fails their
          submission. Not display:none, which some bots detect.
        */}
        <div className="absolute left-[-9999px]" aria-hidden="true">
          <label htmlFor="website">Leave this field empty</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {siteKey ? (
          /* `state` is a new object after every submission, so passing it as
             the reset key mints a fresh token whenever the previous one was
             spent — which is any completed attempt, successful or not. */
          /* Keyed on captchaSpent, NOT on `state` itself: a rejection that
             never reached Turnstile leaves the token unused, and resetting it
             then is what previously left retries submitting an empty token. */
          <TurnstileWidget
            siteKey={siteKey}
            resetKey={state.captchaSpent ? state : null}
            onTokenChange={handleToken}
          />
        ) : null}

        <SubmitButton disabled={Boolean(siteKey) && !hasToken}>
          Send message
        </SubmitButton>

        {siteKey && !hasToken ? (
          <p className="text-xs text-muted-foreground" role="status">
            Complete the security check above to send your message.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          We use your details only to reply to this enquiry. See our{" "}
          <a href="/privacy" className="underline underline-offset-4">
            privacy notice
          </a>
          .
        </p>
      </form>
    </>
  );
}

function Field({
  id,
  name,
  label,
  hint,
  errors,
  ...props
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  errors?: string[];
} & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
        {hint ? (
          <span className="ml-2 font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-error` : undefined}
        className="h-11 w-full rounded-(--radius) border border-input-border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        {...props}
      />
      {errors ? (
        <p id={`${id}-error`} className="text-sm text-error">
          {errors[0]}
        </p>
      ) : null}
    </div>
  );
}
