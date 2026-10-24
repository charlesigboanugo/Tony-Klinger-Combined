"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AppCode } from "@/app/auth/2fa/AppCode";
import { useVerifiedElsewhere } from "@/app/auth/2fa/useVerifiedElsewhere";
import { KeyIcon } from "@/app/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

type Factor = { id: string; name: string; kind: "key" | "app" };

/**
 * The second step of signing in — note 05 §11.1.
 *
 * PROMPTS IMMEDIATELY, which is how two-factor authentication is expected to
 * behave. Previously a staff sign-in dropped the operator on the account
 * SECURITY SETTINGS page and asked them to find and press a button; the second
 * factor is part of signing in, not a preference to go and configure, and
 * putting it in settings made an ordinary login feel like an error state.
 *
 * The key prompt fires on mount. A visible button remains for the cases where
 * that cannot work:
 *
 *   - Safari and some browsers require a user gesture for `credentials.get()`
 *     and reject an automatic call with NotAllowedError;
 *   - the operator dismissed the prompt and wants another go;
 *   - the key was not to hand the first time.
 *
 * So the automatic attempt is an accelerator, never the only route — a flow
 * that depends on autoplay-style behaviour is a flow that strands people.
 *
 * EACH KEY IS CHALLENGED SEPARATELY. A challenge is issued against one factor,
 * so a staff account holding the required spare (note 06 §25.1) would otherwise
 * be stuck if the first key were the one left at home. Every registered key is
 * offered by name.
 *
 * AN AUTHENTICATOR APP IS THE OTHER WAY IN (2026-10-24). With no key, the code
 * box is the whole step and nothing is prompted; with both, the key leads and
 * "Use your authenticator app instead" switches over. Either raises the
 * session to aal2. `factors` holds only the kinds this site can challenge.
 */
export function Challenge({
  factors,
  rpId,
  origin,
  next,
  reconfirm = false,
}: {
  factors: Factor[];
  rpId: string;
  origin: string;
  next: string;
  /** A deliberate re-confirmation: already aal2, so another tab proves nothing. */
  reconfirm?: boolean;
}) {
  const router = useRouter();
  const keys = factors.filter((f) => f.kind === "key");
  const apps = factors.filter((f) => f.kind === "app");
  const [mode, setMode] = useState<"key" | "app">(keys.length > 0 ? "key" : "app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const attempted = useRef(false);

  // Confirmed in another tab: go where this one was heading.
  const leave = useCallback(() => {
    router.replace(next);
    router.refresh();
  }, [router, next]);
  useVerifiedElsewhere(leave, !reconfirm && !done);

  const verify = useCallback(
    async (factorId: string) => {
      setBusy(true);
      setError(null);

      const supabase = createClient();

      try {
        const { data: challenge, error: challengeError } =
          await supabase.auth.mfa.challenge({
            factorId,
            webauthn: { rpId, rpOrigins: [origin] },
          });
        if (challengeError || !challenge) {
          throw challengeError ?? new Error("challenge failed");
        }

        const options = (
          challenge as unknown as {
            webauthn: {
              credential_options: {
                publicKey: PublicKeyCredentialRequestOptions;
              };
            };
          }
        ).webauthn.credential_options;

        const assertion = (await navigator.credentials.get(
          options as CredentialRequestOptions,
        )) as PublicKeyCredential | null;
        if (!assertion) throw new Error("cancelled");

        const { error: verifyError } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: challenge.id,
          webauthn: {
            rpId,
            rpOrigins: [origin],
            type: "request",
            credential_response: assertion as never,
          },
        } as never);
        if (verifyError) throw verifyError;

        /*
          The SERVER only sees `aal2` once a new access token carrying it arrives
          in a cookie. Navigating before that refresh means the gate re-reads the
          old token, decides the session is still aal1, and bounces the operator
          straight back here.
        */
        await supabase.auth.refreshSession();

        setDone(true);
        router.replace(next);
        router.refresh();
      } catch (caught) {
        const cancelled =
          caught instanceof Error &&
          (caught.name === "NotAllowedError" || caught.message === "cancelled");
        setError(
          cancelled
            ? "That was cancelled, or your key didn't respond. Try again when you're ready."
            : factors.length > 1
              ? "We couldn't confirm that key. Try it again, or use another way below."
              : "We couldn't confirm that key. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [rpId, origin, next, router, factors.length],
  );

  /*
    One automatic attempt on arrival, against the first key.

    Scheduled rather than fired from the effect body, for two reasons: the page
    paints before the browser's key dialog covers it, so dismissing the dialog
    reveals a usable screen instead of a blank one; and the `attempted` guard
    sits inside the callback, where React's development double-invoke cancels
    the first timer and the second one wins — firing exactly one prompt in
    development and in production alike.
  */
  const firstKey = keys[0]?.id;
  useEffect(() => {
    if (!firstKey || typeof window === "undefined" || !window.PublicKeyCredential) return;

    const timer = window.setTimeout(() => {
      if (attempted.current) return;
      attempted.current = true;
      void verify(firstKey);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [verify, firstKey]);

  if (mode === "app") {
    return (
      <div className="space-y-4">
        <AppCode apps={apps} next={next} />
        {keys.length > 0 ? (
          <Button variant="outline" size="lg" className="w-full" onClick={() => setMode("key")}>
            Use your security key instead
          </Button>
        ) : null}
      </div>
    );
  }

  if (done) {
    return (
      <FormMessage tone="success">Confirmed. Taking you through&hellip;</FormMessage>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage>{error}</FormMessage> : null}

      {/* The key mark. While the browser waits for the key, a teal ring
          pulses around it — a state cue, so it uses the accent — which tells
          the operator the page is listening, not frozen. */}
      <div className="flex items-center gap-4 rounded-(--radius-lg) border border-border bg-surface p-4">
        <span className="relative grid size-12 shrink-0 place-items-center rounded-full bg-surface-muted text-primary">
          {busy ? (
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border-2 border-accent animate-ping motion-reduce:animate-none"
            />
          ) : null}
          <KeyIcon className={cn(busy && "text-accent")} />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground" aria-live="polite">
          {busy
            ? "Waiting for your security key…"
            : "Your browser should have asked for your key. If it didn't, use the button below."}
        </p>
      </div>

      <Button
        onClick={() => verify(keys[0].id)}
        disabled={busy}
        aria-busy={busy}
        size="lg"
        className="w-full"
      >
        {busy ? "Waiting for your key…" : `Use ${keys[0].name}`}
      </Button>

      {keys.length > 1 ? (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Or use another key
          </p>
          <ul className="mt-2 space-y-2">
            {keys.slice(1).map((factor) => (
              <li key={factor.id}>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full"
                  disabled={busy}
                  onClick={() => verify(factor.id)}
                >
                  {factor.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {apps.length > 0 ? (
        <Button variant="outline" size="lg" className="w-full" disabled={busy} onClick={() => setMode("app")}>
          Use your authenticator app instead
        </Button>
      ) : null}
    </div>
  );
}
