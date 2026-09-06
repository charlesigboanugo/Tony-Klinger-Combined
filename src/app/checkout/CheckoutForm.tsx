"use client";

import { useActionState } from "react";

import { startCheckoutAction, type CheckoutState } from "@/app/checkout/actions";
import { Field, FormMessage, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";

const initialState: CheckoutState = {};

export function CheckoutForm({
  product,
  billing,
  signedInEmail,
}: {
  /**
   * The single product for a buy-now checkout. Omitted for a CART checkout,
   * where the server reads the cart instead — the browser never names the
   * lines, so it cannot add any.
   */
  product?: string;
  /** Carried so the amount charged matches the amount displayed. */
  billing?: string;
  signedInEmail: string | null;
}) {
  const [state, action] = useActionState(startCheckoutAction, initialState);

  return (
    <form action={action} className="space-y-5">
      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {product ? <input type="hidden" name="product" value={product} /> : null}
      {billing ? <input type="hidden" name="billing" value={billing} /> : null}

      {signedInEmail ? (
        <p className="text-sm text-muted-foreground">
          Purchasing as <span className="font-medium text-foreground">{signedInEmail}</span>
        </p>
      ) : (
        <Field
          label="Email"
          name="email"
          hint="Your receipt and access link go here. You don't need an account to buy."
        >
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
      )}

      <SubmitButton className="w-full" pendingLabel="Redirecting to payment…">
        Continue to payment
      </SubmitButton>

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
