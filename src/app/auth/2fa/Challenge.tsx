"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

type Factor = { id: string; name: string };

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
 */
export function Challenge({
  factors,
  rpId,
  origin,
  next,
}: {
  factors: Factor[];
  rpId: string;
  origin: string;
  next: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const attempted = useRef(false);

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
              ? "We couldn't confirm that key. Try it again, or use your other key."
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
  useEffect(() => {
    if (typeof window === "undefined" || !window.PublicKeyCredential) return;

    const timer = window.setTimeout(() => {
      if (attempted.current) return;
      attempted.current = true;
      void verify(factors[0].id);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [verify, factors]);

  if (done) {
    return (
      <FormMessage tone="success">Confirmed. Taking you through&hellip;</FormMessage>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage>{error}</FormMessage> : null}

      <p className="text-sm text-muted-foreground">
        {busy
          ? "Waiting for your security key…"
          : "Your browser should have asked for your key. If it didn't, use the button below."}
      </p>

      <Button
        onClick={() => verify(factors[0].id)}
        disabled={busy}
        aria-busy={busy}
        size="lg"
        className="w-full"
      >
        {busy ? "Waiting for your key…" : `Use ${factors[0].name}`}
      </Button>

      {factors.length > 1 ? (
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Or use another key
          </p>
          <ul className="mt-2 space-y-2">
            {factors.slice(1).map((factor) => (
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
    </div>
  );
}
