"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

/**
 * WebAuthn enrolment — note 05 §11.1.
 *
 * Must run in the browser: `navigator.credentials` has no server equivalent,
 * which is precisely the property that makes WebAuthn unphishable. The browser
 * binds the credential to this origin, so it cannot be replayed against a
 * lookalike site the way a typed TOTP code can.
 *
 * Enrolment is three steps:
 *   enroll()    -> a factor id
 *   challenge() -> creation options from the server
 *   verify()    -> the authenticator's response, checked server-side
 */
export function EnrolWebAuthn({
  rpId,
  origin,
  existingNames = [],
  onEnrolled,
}: {
  rpId: string;
  origin: string;
  /** Names already taken on this account, so a default cannot collide. */
  existingNames?: string[];
  onEnrolled?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const unsupported =
    typeof window !== "undefined" && !window.PublicKeyCredential;

  /*
    A name that is not already taken.

    The default was `Security key <date>`, which meant registering a SECOND key
    on the same day always collided — Supabase rejects duplicate friendly names
    with 422 `mfa_factor_name_conflict`, and the generic catch below reported
    "we couldn't register that key" while the real reason sat in the console.
    That is the error that appeared every time an operator was (wrongly) asked
    to enrol again on each sign-in.
  */
  function defaultName(): string {
    const taken = new Set(existingNames.map((n) => n.toLowerCase()));
    const base = `Security key ${new Date().toLocaleDateString()}`;
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; i < 50; i++) {
      const candidate = `${base} (${i})`;
      if (!taken.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${Date.now()}`;
  }

  async function enrol() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    let factorId: string | undefined;

    try {
      const chosen = name.trim() || defaultName();

      // Caught here so the operator is told the actual problem before a
      // round trip, rather than after a 422.
      if (existingNames.some((n) => n.toLowerCase() === chosen.toLowerCase())) {
        throw new Error("duplicate-name");
      }

      const { data: enrolled, error: enrolError } = await supabase.auth.mfa.enroll({
        factorType: "webauthn",
        friendlyName: chosen,
      });
      if (enrolError || !enrolled) throw enrolError ?? new Error("enroll failed");
      factorId = enrolled.id;

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
          webauthn: { credential_options: { publicKey: PublicKeyCredentialCreationOptions } };
        }
      ).webauthn.credential_options;

      const credential = (await navigator.credentials.create(
        options as CredentialCreationOptions,
      )) as PublicKeyCredential | null;

      if (!credential) throw new Error("cancelled");

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        webauthn: {
          rpId,
          rpOrigins: [origin],
          type: "create",
          credential_response: credential as never,
        },
      } as never);

      if (verifyError) throw verifyError;

      /*
        Force a token refresh before revalidating.

        `mfa.verify()` elevates the session to aal2, but the SERVER only learns
        that when a new access token carrying `aal2` reaches it in a cookie.
        Calling `router.refresh()` immediately re-renders the server components
        against the OLD token, so the gate that sent the operator here decides
        they are still aal1 and redirects them straight back — the fix appears
        to do nothing. Refreshing first makes the elevation durable before
        anything server-side reads it.
      */
      await supabase.auth.refreshSession();

      setDone(true);
      onEnrolled?.();
      router.refresh();
    } catch (caught) {
      // A half-finished factor would count against the two-factor minimum
      // without being usable, so remove it rather than leave it behind.
      if (factorId) {
        await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
      }

      /*
        Say what actually went wrong. A single generic message meant the two
        most common failures — a cancelled prompt and a duplicate name — were
        indistinguishable, so the operator retried the one thing guaranteed to
        fail again.
      */
      const raw =
        caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught);

      const message = /duplicate-name|name_conflict|already exists/i.test(raw)
        ? "You already have a key with that name. Give this one a different name — for example 'Backup key'."
        : caught instanceof Error && caught.name === "NotAllowedError"
          ? "That was cancelled, or the key didn't respond in time."
          : /already registered|InvalidStateError/i.test(raw)
            ? "That device is already registered on this account. Use a different device for a spare key."
            : "We couldn't register that security key. Please try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  if (unsupported) {
    return (
      <FormMessage>
        This browser doesn&apos;t support security keys. Use a current version of
        Chrome, Safari, Edge or Firefox.
      </FormMessage>
    );
  }

  if (done) {
    return <FormMessage tone="success">Security key registered.</FormMessage>;
  }

  return (
    <div className="space-y-4">
      {error ? <FormMessage>{error}</FormMessage> : null}

      <Field
        label="Name this key"
        name="friendlyName"
        hint="So you can tell your keys apart later — e.g. 'Laptop' or 'YubiKey'."
      >
        <Input
          name="friendlyName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Laptop"
          disabled={busy}
        />
      </Field>

      <Button onClick={enrol} disabled={busy} aria-busy={busy}>
        {busy ? "Waiting for your key…" : "Register a security key"}
      </Button>
    </div>
  );
}
