"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { createClient } from "@/lib/supabase/client";

type App = { id: string; name: string };

/**
 * The 6-digit box, shared by signing in and by setting an app up, so both
 * accept the same input: digits only, spaces ignored (apps show "123 456"),
 * and the phone's one-time-code autofill offered.
 */
export function CodeField({ disabled, autoFocus }: { disabled?: boolean; autoFocus?: boolean }) {
  return (
    <Field label="6-digit code" name="code" hint="From the authenticator app on your phone.">
      <Input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]{6,7}"
        title="Enter the 6 digits your app shows."
        maxLength={7}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder="123 456"
        className="font-mono tracking-[0.3em]"
      />
    </Field>
  );
}

/** Why a code was refused, in words — Supabase's own messages are for developers. */
export function codeError(caught: unknown): string {
  const raw = caught instanceof Error ? caught.message : String(caught);
  if (/too many|rate limit|429/i.test(raw)) return "Too many tries. Wait a minute, then use the newest code.";
  if (/invalid|expired|verification failed/i.test(raw)) {
    return "That code didn't work. Use the newest one your app shows — if it keeps failing, check your phone's clock is set automatically.";
  }
  return "We couldn't check that code. Please try again.";
}

/**
 * The authenticator-app half of the second step — note 05 §11.1.
 *
 * One call does the work: `challengeAndVerify` issues a challenge against the
 * app's factor and checks the code against it, raising the session to aal2.
 */
export function AppCode({ apps, next }: { apps: App[]; next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState(apps[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setBusy(true);
    setError(null);

    const supabase = createClient();
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
      if (verifyError) throw verifyError;

      // As for a key: the server sees aal2 only once the new token is in the cookie.
      await supabase.auth.refreshSession();
      setDone(true);
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(codeError(caught));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <FormMessage tone="success">Confirmed. Taking you through&hellip;</FormMessage>;
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <FormMessage>{error}</FormMessage> : null}

      <div className="flex items-center gap-4 rounded-(--radius-lg) border border-border bg-surface p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-muted text-primary">
          <Icon name="phone" className="size-6" />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Open your authenticator app and enter the code it shows for Tony Klinger.
        </p>
      </div>

      {/* Rare, but an account may have set up more than one app. */}
      {apps.length > 1 ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Which app?</legend>
          {apps.map((app) => (
            <label key={app.id} className="flex items-center gap-3 text-sm">
              <input
                type="radio"
                name="factor"
                value={app.id}
                checked={factorId === app.id}
                onChange={() => setFactorId(app.id)}
                className="size-4 accent-(--accent)"
              />
              {app.name}
            </label>
          ))}
        </fieldset>
      ) : null}

      <CodeField disabled={busy} autoFocus />

      <Button type="submit" size="lg" className="w-full" disabled={busy} aria-busy={busy}>
        {busy ? "Checking…" : "Confirm"}
      </Button>
    </form>
  );
}
