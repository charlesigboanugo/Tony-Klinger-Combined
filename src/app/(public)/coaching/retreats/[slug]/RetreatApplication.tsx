"use client";

import { useActionState } from "react";

import { applyForRetreatAction, type ApplyState } from "@/app/(public)/coaching/actions";
import { Field, FormMessage } from "@/components/ui/Field";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initial: ApplyState = {};

/**
 * Applying for a by-interview retreat's batch — migration 0032.
 *
 * WHAT THE VISITOR SEES DEPENDS ON THEIR APPLICATION FOR THIS BATCH (owner,
 * 2026-10-14):
 *
 *   none                 the form (or "Sign in to apply")
 *   submitted            "Awaiting approval": no form, no second application
 *   interviewing         the same, saying the interview is under way
 *   declined/withdrawn   a short note, and the form to apply again
 *   approved             never reaches here: the sale opens and the page shows
 *                        "Book your place", so they can pay
 *
 * An application is for one batch; the next batch is applied for again.
 */
export function RetreatApplication({
  name,
  batchId,
  batchLabel,
  status,
  signedIn,
  signInHref,
}: {
  name: string;
  batchId: string;
  batchLabel: string;
  status: string | null;
  signedIn: boolean;
  signInHref: string;
}) {
  const [state, action] = useActionState(applyForRetreatAction, initial);
  const current = state.status ?? status;

  if (current === "submitted" || current === "interviewing") {
    return (
      <div className="rounded-(--radius) border border-warning/50 bg-warning/10 p-5">
        <p className="font-medium">Awaiting approval</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {current === "interviewing"
            ? `Your interview for ${name} (${batchLabel}) is under way.`
            : `We have your application for ${name} (${batchLabel}) and will be in touch about a short interview.`}{" "}
          Once you are accepted we will email you, and you can book your place here.
        </p>
      </div>
    );
  }

  const declined = current === "declined" || current === "withdrawn";

  return (
    <div>
      <p className="font-display text-2xl font-semibold">By interview</p>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {declined
          ? `Your last application for ${name} (${batchLabel}) was not taken forward. You are welcome to apply again.`
          : `Places on ${name} are offered after a short interview. Apply for ${batchLabel} below and we will be in touch; once you are accepted you can book here.`}
      </p>

      {!signedIn ? (
        <ButtonLink href={signInHref} size="lg" className="mt-5 w-full">
          Sign in to apply
        </ButtonLink>
      ) : (
        <form action={action} className="mt-5 space-y-4">
          <input type="hidden" name="batchId" value={batchId} />
          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          <Field label="About your project" name="project" hint="What you are working on, in a few lines.">
            <textarea
              id="project"
              name="project"
              required
              rows={5}
              maxLength={4000}
              className="w-full rounded-(--radius) border border-input-border bg-background px-3 py-2 text-base"
            />
          </Field>
          <Field label="Your experience so far" name="experience" hint="Optional.">
            <textarea
              id="experience"
              name="experience"
              rows={3}
              maxLength={4000}
              className="w-full rounded-(--radius) border border-input-border bg-background px-3 py-2 text-base"
            />
          </Field>
          <Field label="What you hope to get from the retreat" name="hopes" hint="Optional.">
            <textarea
              id="hopes"
              name="hopes"
              rows={3}
              maxLength={4000}
              className="w-full rounded-(--radius) border border-input-border bg-background px-3 py-2 text-base"
            />
          </Field>
          <SubmitButton pendingLabel="Sending…" className="w-full">
            {declined ? "Apply again" : "Send my application"}
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
