"use client";

import { useActionState, useCallback, useId, useState } from "react";

import { submitContactAction } from "@/app/(public)/contact/actions";
import { TurnstileWidget } from "@/app/(public)/contact/TurnstileWidget";
import { Reveal } from "@/components/motion/Reveal";
import { ButtonArrow, ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { cn } from "@/lib/utils/cn";
import type { ContactFormState } from "@/lib/validation/contact";
import { Eyebrow } from "@/components/ui/Eyebrow";

const MESSAGE_MIN = 20;
const MESSAGE_MAX = 5000;

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
  const [messageLength, setMessageLength] = useState(
    state.values?.message?.trim().length ?? 0,
  );
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
        className="mx-auto max-w-2xl py-8 text-center"
      >
        <span aria-hidden="true" className="mx-auto block h-px w-10 bg-primary" />
        <h2 id="write-heading" className="mt-8">
          Thank you.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground text-pretty">
          {state.success}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/coaching" className="group/btn">
            Explore coaching
            <ButtonArrow />
          </ButtonLink>
          <ButtonLink href="/about" variant="outline">
            Tony&apos;s story
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Reveal className="text-center">
        <Eyebrow align="center">Write to Tony</Eyebrow>
        <h2 id="write-heading" className="mt-5">
          Tell Tony what you have in mind.
        </h2>
        <p className="mx-auto mt-5 max-w-lg leading-relaxed text-muted-foreground text-pretty">
          Coaching, a talk, an interview or a project. A few lines is
          plenty to start.
        </p>
      </Reveal>

      <Reveal delay={120} className="mt-12 sm:mt-14">
      <form
        action={formAction}
        className="relative overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-lift"
        noValidate
      >
        <div className="space-y-9 px-6 pt-10 pb-10 sm:px-12 sm:pt-12 sm:pb-12">
        {state.error ? (
          <p
            id={ids.status}
            role="alert"
            className="rounded-(--radius) border border-error bg-error/10 px-3 py-2 text-sm text-error"
          >
            {state.error}
          </p>
        ) : null}

        <div className="grid gap-9 sm:grid-cols-2 sm:gap-10">
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
        </div>

        <Field
          id={ids.subject}
          name="subject"
          label="Subject"
          hint="Optional"
          defaultValue={state.values?.subject}
          errors={state.fieldErrors?.subject}
        />

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <label htmlFor={ids.message} className={labelClass}>
              Message
            </label>
            {/* Polite, so it is read when the reader pauses, not per keystroke. */}
            <span
              aria-live="polite"
              className={cn(
                "text-xs tabular-nums",
                messageLength > MESSAGE_MAX ? "text-error" : "text-muted-foreground",
              )}
            >
              {messageLength < MESSAGE_MIN
                ? `At least ${MESSAGE_MIN} characters`
                : `${messageLength} / ${MESSAGE_MAX}`}
            </span>
          </div>
          <textarea
            id={ids.message}
            name="message"
            rows={6}
            required
            defaultValue={state.values?.message}
            onChange={(e) => setMessageLength(e.target.value.trim().length)}
            placeholder="A little about you, and what you have in mind."
            aria-invalid={state.fieldErrors?.message ? true : undefined}
            aria-describedby={
              state.fieldErrors?.message ? `${ids.message}-error` : undefined
            }
            className={cn(fieldClass, "min-h-44 resize-y py-3 leading-relaxed")}
          />
          {state.fieldErrors?.message ? (
            <p id={`${ids.message}-error`} className="text-sm text-error">
              {state.fieldErrors.message[0]}
            </p>
          ) : null}
        </div>
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

        <div className="space-y-5 border-t border-border bg-surface-muted/50 px-6 py-8 sm:px-12">
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

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <SubmitButton
            disabled={Boolean(siteKey) && !hasToken}
            pendingLabel="Sending…"
            className="h-13 px-8 text-base"
          >
            Send message
          </SubmitButton>
          <p className="text-sm text-muted-foreground">
            Replies usually within a few working days.
          </p>
        </div>

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
        </div>
      </form>
      </Reveal>
    </div>
  );
}

/** Small-caps labels: quiet, so the words typed are what stands out. */
const labelClass =
  "block text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase";

/**
 * Underlined fields, set in a larger size — the card reads as a page to write
 * on rather than a stack of boxes. Focus thickens the rule to 2px in the teal
 * state colour, which is the focus indicator.
 */
const fieldClass =
  "w-full rounded-none border-0 border-b border-input-border bg-transparent px-0 text-lg transition-[border-color,box-shadow] duration-(--dur-base) placeholder:text-muted-foreground/60 hover:border-foreground/50 focus:border-accent focus:shadow-[0_1px_0_0_var(--accent)] focus:outline-none aria-invalid:border-error";

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
    <div className="space-y-2">
      <label htmlFor={id} className={labelClass}>
        {label}
        {hint ? (
          <span className="ml-2 font-normal tracking-normal normal-case">{hint}</span>
        ) : null}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `${id}-error` : undefined}
        className={cn(fieldClass, "h-12")}
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
