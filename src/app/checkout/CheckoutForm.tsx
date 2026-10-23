"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { magicLinkAction } from "@/app/auth/actions";
import { startCheckoutAction, type CheckoutState } from "@/app/checkout/actions";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { AuthFormState } from "@/lib/validation/auth";

const initialState: CheckoutState = {};
const initialLinkState: AuthFormState = {};

export function CheckoutForm({
  product,
  billing,
  session,
  signedInEmail,
  returnTo,
  gift = false,
  giftHref = null,
  selfHref,
}: {
  /**
   * The single product for a buy-now checkout. Omitted for a CART checkout,
   * where the server reads the cart instead — the browser never names the
   * lines, so it cannot add any.
   */
  product?: string;
  /** Carried so the amount charged matches the amount displayed. */
  billing?: string;
  /** The Group Coaching session a single session is being bought for. */
  session?: string;
  signedInEmail: string | null;
  /** This checkout, to come back to after signing in. */
  returnTo: string;
  /** Bought for someone else: the email asked for is theirs (lib/commerce/gift). */
  gift?: boolean;
  /** This checkout as a gift, or null when what is in it can't be one. */
  giftHref?: string | null;
  /** This checkout for the buyer themselves. */
  selfHref: string;
}) {
  const [state, action] = useActionState(startCheckoutAction, initialState);
  const [linkState, sendLink, sendingLink] = useActionState(magicLinkAction, initialLinkState);
  // Controlled, so the email survives the form coming back from the server.
  const [email, setEmail] = useState("");
  const signInHref = `/auth/sign-in?next=${encodeURIComponent(returnTo)}`;

  // The account offer stands only while the field still holds the email it was
  // made for; typing another address brings back the ordinary button.
  const offer =
    !signedInEmail && !gift && state.accountEmail && email.trim().toLowerCase() === state.accountEmail.toLowerCase()
      ? state.accountEmail
      : null;

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {product ? <input type="hidden" name="product" value={product} /> : null}
      {billing ? <input type="hidden" name="billing" value={billing} /> : null}
      {session ? <input type="hidden" name="session" value={session} /> : null}

      {gift ? (
        /*
          A GIFT (owner, 2026-10-15). The email is the recipient's; they get the
          link to add it to their account. The receipt goes to the payer: their
          account's email when signed in, otherwise the email they give Stripe.
        */
        <>
          <input type="hidden" name="gift" value="1" />
          <p className="text-sm text-muted-foreground">
            You&apos;re buying this as a gift.{" "}
            <Link href={selfHref} className="font-medium text-primary underline underline-offset-4">
              Buy it for yourself instead
            </Link>
          </p>
          <Field
            label="Their email"
            name="email"
            hint={`For someone without an account here. We'll email them a link to set one up and receive it. Your receipt comes to you${
              signedInEmail ? ` at ${signedInEmail}` : ", at the email you give on the payment page"
            }.`}
          >
            <Input
              name="email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
        </>
      ) : signedInEmail ? (
        <p className="text-sm text-muted-foreground">
          Purchasing as <span className="font-medium text-foreground">{signedInEmail}</span>
          {/* Gifting works signed in too; the link was only on the guest line
              (owner, 2026-10-23). Absent when the checkout can't be a gift. */}
          {giftHref ? (
            <>
              . Buying for someone else?{" "}
              <Link href={giftHref} className="font-medium text-primary underline underline-offset-4">
                Buy it as a gift
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <>
          {/* The three ways to buy, in one line (owner, 2026-10-15). */}
          <p className="text-sm text-muted-foreground">
            Have an account?{" "}
            <Link href={signInHref} className="font-medium text-primary underline underline-offset-4">
              Sign in
            </Link>{" "}
            and your purchase goes straight into it. Otherwise, enter your email to buy as a guest
            {giftHref ? (
              <>
                , or{" "}
                <Link href={giftHref} className="font-medium text-primary underline underline-offset-4">
                  buy it as a gift
                </Link>
              </>
            ) : null}
            .
          </p>
          <Field
            label="Email"
            name="email"
            hint="Your receipt and access link go here. You don't need an account to buy."
          >
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
        </>
      )}

      {offer ? (
        /*
          THE EMAIL HAS AN ACCOUNT (owner, 2026-10-15; note 05 §29.2.1). Its
          owner must sign in to buy with it, so what they already hold is checked and the purchase
          lands in their account. A gift can't go to it either (§29.2.2).
        */
        <div role="status" className="rounded-(--radius) border border-border bg-surface-muted p-5 text-sm">
          <p className="font-semibold text-foreground">{offer} already has an account</p>
          <p className="mt-1 text-muted-foreground">
            Please sign in to buy with this email. Your purchase goes straight into your account.
          </p>

          {linkState.success ? (
            <p className="mt-4 font-medium text-foreground">
              Check your inbox. The link signs you in and brings you back here to pay.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {/* Uses this form's own email field and the `next` below. */}
              <Button
                type="submit"
                formAction={sendLink}
                formNoValidate
                disabled={sendingLink}
                aria-busy={sendingLink}
                className="sm:flex-1"
              >
                {sendingLink ? "Sending…" : "Email me a sign-in link"}
              </Button>
              <ButtonLink href={signInHref} variant="outline" className="sm:flex-1">
                Sign in another way
              </ButtonLink>
            </div>
          )}
          <input type="hidden" name="next" value={returnTo} />

        </div>
      ) : (
        <SubmitButton className="w-full" pendingLabel="Redirecting to payment…">
          Continue to payment
        </SubmitButton>
      )}

      {/*
        THE SOFT OPT-IN DEPENDS ON THIS NOTICE EXISTING HERE.

        PECR reg 22 lets us market to customers without prior consent only if a
        simple refusal was offered AT THE POINT THE DETAILS WERE COLLECTED, and
        in every message since. An unsubscribe link in the emails alone is not
        enough — this is the half most sites miss, and without it every
        marketing email to a customer is unlawful.

        Wording, not a tickbox, because the lawful basis here is soft opt-in
        rather than consent; a tickbox would imply we are asking permission we
        do not in fact need, and an unticked one would suppress a list we are
        entitled to build.
      */}
      <p className="text-xs text-muted-foreground">
        We may email you occasional news about similar coaching, courses and
        events. Every email has an unsubscribe link, and you can opt out at any
        time in{" "}
        <a href="/account/notifications" className="underline underline-offset-4">
          your notification settings
        </a>
        .
      </p>

      <p className="text-xs text-muted-foreground">
        Card details are entered on Stripe&apos;s payment page. They never reach
        this site.
      </p>
    </form>
  );
}
