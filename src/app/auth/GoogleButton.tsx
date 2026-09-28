"use client";

import { useFormStatus } from "react-dom";

import { googleSignInAction } from "@/app/auth/actions";

/**
 * "Continue with Google" — note 05 §7.1.
 *
 * A POST form rather than a link, because it is a server-side action that mints
 * a provider redirect.
 *
 * THE APPEARANCE IS DELIBERATELY NOT THEMED. People identify this control by
 * its look — the four-colour mark and the familiar plain surface — and a
 * version restyled into the site's own palette stops reading as "the Google
 * account I already have" and starts reading as just another button. So it uses
 * Google's specified surface, border and text colours via the `--google-*`
 * tokens, which carry their own light and dark values.
 *
 * The mark itself is inlined SVG rather than an <img>: it must not depend on a
 * network request that could fail and leave an unlabelled button, and it is a
 * few hundred bytes.
 */

function GoogleMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-5 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-13 w-full items-center justify-center gap-3 rounded-full border border-(--google-border) bg-(--google-bg) px-4 text-[0.9375rem] font-medium text-(--google-text) transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
    >
      <GoogleMark />
      <span>{pending ? "Redirecting…" : label}</span>
    </button>
  );
}

export function GoogleButton({
  next,
  label = "Continue with Google",
}: {
  next?: string;
  label?: string;
}) {
  return (
    <form action={googleSignInAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <GoogleSubmit label={label} />
    </form>
  );
}
