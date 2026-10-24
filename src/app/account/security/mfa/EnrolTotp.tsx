"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { CodeField, codeError } from "@/app/auth/2fa/AppCode";
import { Button } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

type Pending = { factorId: string; qr: string; secret: string };

/**
 * Authenticator-app setup — note 05 §11.1 (2026-10-24).
 *
 *   enroll()              -> a factor id, a QR code and the secret behind it
 *   the person scans it   -> their app starts showing 6-digit codes
 *   challengeAndVerify()  -> one code proves the app holds the secret; the
 *                            factor becomes verified and the session aal2
 *
 * Until that code is checked the factor is unverified and counts for nothing,
 * so leaving part-way (Cancel, or closing the page) is removed rather than left
 * to block the next attempt.
 */
export function EnrolTotp({ existingNames = [] }: { existingNames?: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /** "Authenticator app", or "Authenticator app (2)" when that is taken. */
  function defaultName(): string {
    const taken = new Set(existingNames.map((n) => n.toLowerCase()));
    const base = "Authenticator app";
    if (!taken.has(base.toLowerCase())) return base;
    for (let i = 2; i < 50; i++) if (!taken.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
    return `${base} ${Date.now()}`;
  }

  async function start() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const chosen = name.trim() || defaultName();
      if (existingNames.some((n) => n.toLowerCase() === chosen.toLowerCase())) throw new Error("duplicate-name");

      // An unfinished setup from an earlier visit would otherwise sit on the
      // account and can hold the name this one wants.
      const { data: listed } = await supabase.auth.mfa.listFactors();
      for (const stale of listed?.all ?? []) {
        if (stale.factor_type === "totp" && stale.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: stale.id }).catch(() => undefined);
        }
      }

      const { data, error: enrolError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: chosen,
        issuer: "Tony Klinger",
      });
      if (enrolError || !data) throw enrolError ?? new Error("enroll failed");
      setPending({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (caught) {
      const raw = caught instanceof Error ? caught.message : String(caught);
      setError(
        /duplicate-name|name_conflict|already exists/i.test(raw)
          ? "You already have one with that name. Give this one a different name — for example 'Work phone'."
          : /totp_enroll_not_enabled|enroll is disabled/i.test(raw)
            ? "Authenticator apps aren't switched on for this site yet. Please tell the site administrator."
            : "We couldn't start the setup. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s/g, "");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: pending.factorId, code });
      if (verifyError) throw verifyError;
      // The server sees aal2 only once the new token is in the cookie.
      await supabase.auth.refreshSession();
      setDone(true);
      router.refresh();
    } catch (caught) {
      setError(codeError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (pending) {
      await createClient().auth.mfa.unenroll({ factorId: pending.factorId }).catch(() => undefined);
    }
    setPending(null);
    setError(null);
  }

  if (done) {
    return <FormMessage tone="success">Authenticator app set up. You&apos;ll be asked for a code when you sign in.</FormMessage>;
  }

  if (!pending) {
    return (
      <div className="space-y-4">
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Field label="Name this app" name="totpName" hint="Optional. Helps tell them apart if you set up more than one.">
          <Input
            name="totpName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My phone"
            disabled={busy}
          />
        </Field>
        <Button onClick={start} disabled={busy} aria-busy={busy}>
          {busy ? "Starting…" : "Set up an authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirm} className="space-y-5">
      {error ? <FormMessage>{error}</FormMessage> : null}

      <ol className="space-y-5 text-sm">
        <li>
          <p className="font-medium">1. Scan this with your authenticator app</p>
          <p className="mt-1 text-muted-foreground">
            Any app works — Google Authenticator, Microsoft Authenticator, 2FAS, 1Password. In the app, choose
            &ldquo;Add account&rdquo; or the + button, then scan.
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-5">
            {/* Supabase returns the QR as an SVG data URI; white behind it in
                both themes, since a scanner needs dark-on-light. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pending.qr}
              alt="QR code to add this account to your authenticator app"
              width={176}
              height={176}
              className="size-44 rounded-(--radius) border border-border bg-white p-2"
            />
            <div className="min-w-0 flex-1 basis-56">
              <p className="text-muted-foreground">Can&apos;t scan? Type this key into the app instead:</p>
              <p className="mt-2 rounded-(--radius) bg-surface-muted px-3 py-2 font-mono text-sm break-all select-all">
                {pending.secret.match(/.{1,4}/g)?.join(" ")}
              </p>
            </div>
          </div>
        </li>
        <li>
          <p className="font-medium">2. Enter the code it shows</p>
          <div className="mt-3 max-w-xs">
            <CodeField disabled={busy} />
          </div>
        </li>
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? "Checking…" : "Confirm and finish"}
        </Button>
        <Button type="button" variant="ghost" onClick={cancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
