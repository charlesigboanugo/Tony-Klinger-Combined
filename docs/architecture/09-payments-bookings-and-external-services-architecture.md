# Tony Klinger — Payments, Bookings & External Services Architecture

**File:** `09-payments-bookings-and-external-services-architecture.md`

## 1. Purpose

Define the architecture for payments, checkout, subscriptions, bookings and external service integrations across the Tony Klinger platform.

This note covers:

- Guest and signed-in checkout
- Cart and checkout
- Orders and order items
- Stripe payments
- Recurring memberships
- Payment webhooks
- Payment-to-entitlement processing
- Booking and availability
- Group Coaching bookings
- Cohort and retreat registration
- Events
- Private Coaching
- Brevo/email integration
- External service boundaries
- Webhook security
- Idempotency
- Background processing
- Reconciliation
- Failure handling

The database structures are defined in the Supabase & Server architecture.

Authentication and authorization are defined in the Authentication and Roles architectures.

---

## 2. Core Principle

The following concepts must remain separate:

```text
PAYMENT ≠ ORDER ≠ ENTITLEMENT ≠ BOOKING
```

A payment represents money processed.

An order represents what the customer purchased.

An entitlement represents what the customer is allowed to access or consume.

A booking represents a specific scheduled participation.

---

## 3. Commercial Flow

The standard commercial flow is:

```text
PRODUCT
   ↓
CART / CHECKOUT
   ↓
ORDER
   ↓
PAYMENT
   ↓
PAYMENT CONFIRMATION
   ↓
ENTITLEMENT
   ↓
ACCESS / BOOKING / DELIVERY
```

The browser redirect after payment is not the authoritative payment confirmation.

Trusted payment events must determine whether payment succeeded.

---

## 4. Guest and Signed-In Checkout

The platform supports both:

```text
Guest checkout
```

and:

```text
Signed-in checkout
```

### Guest checkout

A visitor may complete a purchase without an existing account.

```text
Guest
 ↓
Checkout
 ↓
Order
 ↓
Payment
 ↓
Account creation / linking
 ↓
Entitlement
```

### Signed-in checkout

An existing customer can sign in before or during checkout.

```text
Signed-in customer
 ↓
Checkout
 ↓
Order linked to user
 ↓
Payment
 ↓
Entitlement
```

Both flows must result in a secure customer identity for account-based delivery.

**2026-10-15 (owner):** an email that already has an account cannot check out as a guest —
its owner signs in; a guest or signed-in customer can buy for someone else as a
gift, made out to the recipient's email, which must have no account; and a signed-in customer can add paid guest orders
made with their confirmed email from their account. Rules in note 05 §29.2.1, §29.2.2 and
§29.3.

---

## 5. Guest Checkout Identity

A guest checkout must collect sufficient contact information to create the order.

The checkout email is useful for communication and later account linking, but an email address alone must not be treated as unconditional proof of account ownership.

A guest purchase is a real commercial order.

It must not be treated as an abandoned cart merely because the customer has not yet created or claimed an account.

---

## 6. Incorrect Guest Email

If a guest enters an incorrect email, they may not be able to receive account or verification messages.

Therefore the system must provide a controlled recovery/support process for a paid customer who cannot access the entered email.

The application must not allow arbitrary takeover of an order merely by knowing:

```text
order_id
```

or:

```text
email address
```

---

## 7. Guest Order Claiming

A guest purchase may later be linked to an authenticated account.

The claim process must use secure ownership evidence.

Possible mechanisms include:

- Secure signed claim token
- Authenticated account creation from the checkout flow
- Verified checkout-session/order reference
- Other trusted server-side evidence

The final implementation must prevent one authenticated customer from claiming another customer's paid order.

---

## 8. Cart

The cart is responsible for collecting intended purchases before checkout.

The browser may maintain temporary cart state for user experience, but the server must validate:

- Product existence
- Product availability
- Price
- Currency
- Quantity
- Eligibility
- Membership state where relevant
- Any applicable discount

The server must calculate or validate the authoritative checkout total.

### 8.1 Which purchase flow each product type uses

**Recorded 2026-09-06, confirming the setup already built.** Not every product belongs in
the cart, and this is not a style preference per product — it follows from three concrete
questions, in order:

```text
Is it flat-fee and single Stripe mode (always one_time, or always recurring)?
  → yes: safe to combine freely            → Cart
  → no, it can be either depending on choice → must never share a session with
                                                anything else                → Buy-now

Does it need a real configuration step before it is even a well-formed purchase
(a choice beyond quantity — a billing period, a specific series)?
  → yes                                     → Buy-now (the config lives on the
                                                product's own page, before checkout)

Does it depend on a specific calendar slot existing before payment means anything?
  → yes                                     → Book-first, pay to confirm
                                                (nothing on sale uses this since
                                                2026-10-08 — private coaching is
                                                pay first, then book)
```

```text
Courses                Cart       — always one_time, no configuration, genuinely
                                    worth combining (Level One + Level Two together)
Group Coaching series  Cart       — same shape: always one_time, buying series
                                    ACCESS is separate from booking a dated SESSION,
                                    so there is no capacity risk at the point of sale
Memberships            Buy-now    — NEVER the cart. Sold both ways (§16): a monthly
                                    subscription (mode: "subscription") and a one-year
                                    lump sum (mode: "payment"). Stripe refuses a
                                    session mixing the two, and letting membership
                                    into a general cart would force every other cart
                                    item to inherit that restriction. It is also a
                                    configurator — billing period branches the price,
                                    and Silver/Gold additionally require choosing
                                    which specific Group Coaching series the tier
                                    applies to (R30) — a choice that belongs on the
                                    tier's own page, not a cart line-item edit
Cohorts                Buy-now    — capacity-limited, single high-commitment
                                    decision. Sitting in a cart between "add" and
                                    "pay" risks paying for a place that has since
                                    filled; there is no cart-item hold/reservation
                                    mechanism, so buy-now collapses that window to
                                    effectively zero
Private coaching       Buy-now, then book — one session or a pack, bought through
                                    checkout like any product (guests included);
                                    a time is chosen afterwards with the session
                                    the purchase grants (§36). Was book-first until
                                    the owner reversed it on 2026-10-08
Retreats                (undecided) — no live product yet. Settle deliberately when
                                    built: one fixed-capacity instance behaves like a
                                    cohort (buy-now), several selectable dates behave
                                    book-first, pay to confirm. Do not inherit
                                    whichever pattern happens to be nearest by default.
```

The mixed-basket refusal this depends on already exists in code
(`src/app/checkout/actions.ts`): a session holding both a recurring and a one-time
line is rejected outright, with the reasoning kept in the comment there — "a basket
holding a subscription and a book is two different commitments that should be agreed
to separately." This section makes explicit what was previously only implicit in
which pages happened to render `AddToCart` versus a direct link to `/checkout`.

### 8.2 Changing a choice in the cart and at checkout (2026-10-08)

A cart line whose product is one option of several (note 07 §14.1) carries the switch: the
line is swapped for the other product in place (`switchCartOptionAction`, which accepts only a
product the database lists as an alternative of that line). A membership line carries the
monthly / one-year switch. A buy-now checkout shows the same two switches in its summary, each
choice a link back to `/checkout` with the other product or period.

`/checkout?product=<slug>` names any product. The older kind-specific parameters
(`membership`, `course`, `series`, `cohort`, `retreat`, `event`) mean the same and are still
read. `cohort` was not read before this change, so a cohort's "Join" button reached an empty
checkout.

**Once in the cart, not offered again (owner, 2026-10-08).** A product page asks `/api/session`
which products are in the cart (`cartSlugs`) and, for one that is, shows "In your cart" with
"View cart" and "Remove" in place of "Add to cart". `addToCartAction` refuses a duplicate
regardless. Where another option of the same offer is in the cart, adding this one replaces
it — one offer is one cart line — and the button says so.

**One of each at a time (owner, 2026-10-08).** Within one order, every item is bought singly. The cart has no quantity
control, `addLine` never raises a quantity, a cart cookie written earlier is read as one of
each, and `priceCart` prices every line at a quantity of one whatever it is handed. Someone
who wants a second pack buys it as a second order.

---

## 9. Price Integrity

Never trust a total supplied by the browser.

The flow is:

```text
Browser cart
    ↓
Server validates products/prices
    ↓
Server calculates authoritative total
    ↓
Create/update order
    ↓
Create Stripe Checkout Session
```

The browser may display an estimated total, but the server remains authoritative.

---

## 10. Order Creation

An internal order should be created or reserved before payment where an internal order reference is required.

An order must preserve enough information to understand the transaction later.

An order should not depend on the current product description or current price to reconstruct historical data.

---

## 11. Order Items

Each order item should identify the purchased product and relevant purchase-time pricing.

Conceptually:

```text
Order
 ↓
Order Items
 ↓
Product / Price
```

Purchase-time values should be preserved so that changing a product later does not change the historical order.

---

## 12. Stripe

Stripe is the planned payment provider.

Stripe is responsible for:

- Payment processing
- Stripe Checkout
- Recurring billing
- Subscription lifecycle
- Invoices
- Payment events
- Customer/payment-provider records

Tony Klinger application data remains the application's source of truth for its own orders, memberships and entitlements after trusted Stripe events are processed.

### 12.1 Catalogue mirror

Each product has one Stripe Product and each active price one Stripe Price, recorded back as `products.stripe_product_id` and `prices.stripe_price_id` (`lib/stripe/sync.ts`). The sync runs immediately when an administrator saves a product or price, and the scheduled `sync-stripe` job sweeps every active and paused product as a safety net.

The Stripe Product's name and description follow the product's: a rename in admin updates the existing Stripe Product in place (2026-10-15). A Stripe Price cannot be edited, so a changed amount, currency or interval archives the old Price and creates a replacement. The slug and row id travel only in metadata, for tracing.

---

## 13. Stripe Checkout

Use Stripe Checkout where appropriate rather than implementing raw card processing directly in the Tony Klinger application.

Conceptually:

```text
Tony Klinger
     ↓
Create Checkout Session
     ↓
Stripe-hosted Checkout
     ↓
Customer payment
     ↓
Stripe webhook
     ↓
Tony Klinger backend
```

The exact Stripe SDK and Checkout implementation must use the current stable Stripe recommendations when implementation begins.

---

## 14. Checkout Session

A Stripe Checkout Session should contain sufficient trusted references to associate the external payment with the internal order.

Where appropriate, use server-generated identifiers such as:

```text
order_id
```

Do not trust arbitrary browser-supplied identifiers when associating payment with an order.

---

## 15. One-Time Purchases

For a one-time purchase:

```text
Product
 ↓
Order
 ↓
Stripe Checkout
 ↓
Payment
 ↓
Stripe webhook
 ↓
Order marked paid
 ↓
Entitlement created
 ↓
Customer receives access
```

The entitlement operation must be idempotent.

---

## 16. Recurring Memberships

Memberships may use recurring Stripe subscriptions.

Conceptually:

```text
Membership
 ↓
Stripe Subscription
 ↓
Recurring billing
 ↓
Subscription state
 ↓
Membership state
 ↓
Membership entitlements
```

Membership access must reflect the authoritative subscription state.

## 16.1 Two ways to buy a membership

> **Owner, 2026-10-09: only the lump sum is on sale.** Membership is one payment for twelve
> months that does not renew (note 07). The recurring prices are removed (or, where an order
> or subscription still names one, switched off), so no new subscription is created; the subscription path below is kept for any that already exist
> and for the day a recurring price is switched back on. The storefront, cart and checkout
> word themselves from the active prices (`leadPrice`, `periodNote` in
> `lib/commerce/billing`) and show no monthly/yearly switch while a tier is sold one way.

Every membership tier is purchasable **either** as a recurring subscription **or** as a
one-time payment for a fixed year. Both grant the same benefits for the same duration; they
differ only in how the money arrives and whether the term renews by itself.

A lump-sum purchase creates **no Stripe subscription at all** — there is no
`current_period_end` to read, nothing for the reconciliation job (§44) to reconcile, and
none of §17's subscription states apply to it. Read literally, §16 above would leave a
paying customer with no defined access. The rule that resolves it:

```text
ENTITLEMENT   is the source of truth for ACCESS
SUBSCRIPTION  is the source of truth for RENEWAL
```

**Access is always read from the entitlement, never from the subscription.** The
entitlement carries its own `starts_at` and `expires_at` (note 08 §21), and
`has_active_entitlement()` is the single gate — the same function already used by the
Academy pages, the RLS policies and the signed-URL minting for private storage (note 08
§60.2). There is exactly one access path, and it does not branch on how the membership was
bought.

What differs is only what maintains `expires_at`:

```text
Recurring    Stripe subscription. Each paid invoice extends the entitlement to the new
             current_period_end. A failed renewal engages the grace policy (§17). A
             cancellation stops future extension; access runs to the date already paid for.

Lump sum     Nothing. expires_at is set once at fulfilment to the purchased term and is
             never extended. The entitlement lapses on that date — a status transition,
             not a deletion (note 08 §58).
```

This is not a special case bolted on: note 07 §29 already treats an entitlement's source as
first-class, listing purchase and membership as distinct origins. A lump-sum membership is
simply a purchase-derived entitlement that happens to name a membership tier as its
resource.

**Consequences that must be honoured:**

- **Grace periods apply only to recurring.** A grace period exists to absorb a failed
  renewal payment. A lump-sum term has no renewal to fail, so it lapses exactly on
  `expires_at` with no grace.
- **`/account/membership` must not assume a subscription exists.** Where one does, it shows
  renewal date and payment method; where it does not, it shows the expiry date and states
  plainly that the membership does not auto-renew. Note 01 §28 requires the customer to know
  when access ends and whether it renews — for a lump-sum member, "does not renew" is the
  answer and must be shown, not omitted.
- **Reconciliation must not treat a subscription-less membership as broken.** The job in
  §44 looks for orders Stripe says were paid; it must not infer a missing subscription is a
  fault when the order was a one-time purchase.
- **Upgrades (note 07 §39) differ by type.** From a subscription, Stripe proration handles
  it. From a lump-sum term there is nothing to prorate: the new tier's entitlement is
  granted and the old one superseded, and any goodwill credit for unused time is a manual
  `entitlements.adjust` (note 06 §23.1) with a recorded reason — deliberately an audited
  human decision rather than an automatic calculation, because the fair credit depends on
  circumstances the system cannot judge.

**On sale since 2026-10-08: monthly and yearly, both subscriptions** (owner; note 07 §31.1).
The lump-sum year described above is no longer offered, though it remains supported.

**Implemented 2026-10-08 (migration 0012; note 07 §31.2).** The webhook calls
`apply_subscription_membership` after every subscription event, and throws if it fails so
Stripe retries: that call is what turns a subscription into access. A one-time membership
price is granted by `grant_entitlements_for_order` as a year's membership entitlement, running
from now or from the end of a year already held. Checkout refuses a second subscription to an
account that already has one. `/account/memberships`, the account overview and the Academy
read the membership from the entitlement (`my_membership()`), so a lump-sum member is shown as
a member with an end date and "does not renew".

---

## 17. Membership Lifecycle

The system must support relevant states such as:

```text
Active
Past Due
Cancelled
Expired
```

A failed renewal should not automatically imply immediate access removal if a configured grace period applies.

Cancellation may mean:

```text
Cancel renewal
```

while the customer retains access until the end of the paid period.

The exact grace-period and cancellation policy must be explicitly configured.


**Self-service implemented 2026-09-27 (migration 0021), at the owner's direction ("the normal
setup, production ready"):**

- **One Stripe Customer per account** (`billing_customers`, `ensureStripeCustomer`).
  Signed-in checkouts pass `customer` instead of
  `customer_email`; guests still pay by email.
- **Stripe Customer Portal** for card changes, invoice history, billing details and
  cancellation; "Update card" deep-links to `payment_method_update` (`flow_data`). Its settings live in code, `scripts/stripe-portal-setup.mjs`, and
  are selected by `STRIPE_PORTAL_CONFIGURATION_ID`. Cancellation is **at period end** with
  a reason asked; access runs to the date already paid for. **Plan switching is off** in the
  portal: moving between tiers changes entitlements, which the membership rules own.
- **Resume** ("Keep my membership") is done on the site, since the portal has no deep link
  for it; it clears whichever of `cancel_at_period_end` / `cancel_at` Stripe holds.
- **Cancel on the site too** (owner, same day: "cancelling can be done directly through the
  dashboard and on Stripe"). `/account/billing` has its own confirmation dialog —
  access-until date, no further charge, reversible — with an optional reason and comment
  passed to Stripe as `cancellation_details`, so they appear in Stripe's reporting. Same
  outcome as the portal (at period end). The portal's cancel step stays enabled.
- **Receipts:** one-off payments keep Stripe's charge receipt (`payments.receipt_url`,
  captured at fulfilment, or fetched once later if missing); subscriptions use the invoice's
  hosted page and PDF. `/account/billing` lists both, newest first; `/account/orders/[id]`
  links its receipt.

---

## 18. Membership Upgrades and Downgrades

Customers may move between:

```text
Silver
 ↓
Gold
 ↓
Platinum
 ↓
Ultimate Membership
```

The system must recalculate effective entitlements when the membership changes.

Avoid blindly creating duplicate entitlements when processing an upgrade, downgrade or subscription webhook.

---

## 19. Payment Webhooks

Stripe webhooks are the authoritative mechanism for asynchronous payment events.

Relevant events may include:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_succeeded
invoice.payment_failed
```

`checkout.session.expired` is also handled (2026-09-27): it releases a private coaching hold
(§36). Since private coaching became pay first, then book (2026-10-08) no checkout creates a
hold, so it has nothing to release; the handler stays. The production webhook endpoint must
be subscribed to it.

Also handled from 2026-09-27 (migration 0021): `invoice.paid`, `invoice.payment_failed`,
`invoice.finalized` and `invoice.voided` record the subscription invoice for billing history.
They do not change access; the subscription events carry the status (§17).

The implementation must verify the current Stripe event model and official recommendations before coding.

---

## 20. Webhook Verification

Webhook requests must be cryptographically verified using Stripe's webhook-signing mechanism.

Do not trust a request merely because it reached:

```text
/api/stripe/webhook
```

The webhook secret must remain server-side.

---

## 21. Webhook Idempotency

Webhook processing must be idempotent because external providers may deliver the same event more than once.

The system must prevent duplicate:

- Orders
- Entitlements
- Membership changes
- Important emails
- Other side effects

Store an appropriate external event/reference identifier and enforce uniqueness where appropriate.

---

## 22. Webhook Processing Flow

```text
Stripe Event
    ↓
Verify signature
    ↓
Check whether event was processed
    ↓
    ├── Yes → Safe replay / ignore
    │
    └── No
         ↓
      Validate event
         ↓
      Update database
         ↓
      Create required entitlements
         ↓
      Record processing result
```

Operations that must succeed together should use appropriate transactional processing.

---

## 23. Payment Success

Payment success should cause the relevant commercial processing.

Example:

```text
Payment confirmed
      ↓
Order marked paid
      ↓
Entitlement resolved
      ↓
Academy / booking access
```

The customer must not receive paid access solely because they returned from Stripe to a success URL.

---

## 24. Payment Failure

A failed payment must not create a new paid entitlement.

For an existing subscription:

```text
Payment failure
 ↓
Subscription/payment state updated
 ↓
Grace-period policy evaluated
 ↓
Access retained or made inactive according to policy
```

The application must not invent access behaviour that is not defined by the membership policy.

---

## 25. Refunds

Refunds must be represented in the application's commercial state.

A refund may require:

- Payment status update
- Order status update
- Entitlement adjustment/revocation according to policy
- Audit record
- Customer communication

The business refund/access policy must determine whether access is immediately removed, retained for a period, or handled another way.

---

## 26. Checkout Return Flow

Stripe Checkout requires a customer return destination.

Use a dedicated checkout result flow such as:

```text
/checkout/success
/checkout/cancel
```

or the final equivalent defined in the Route & Page Architecture.

The success page may show the current order state, but it must not independently declare that payment succeeded.

---

## 27. Payment Processing State

A customer may return from Stripe before the webhook has finished processing.

Therefore the application should support a temporary state such as:

```text
Payment processing
```

Example:

```text
Return from Stripe
      ↓
Check internal order
      ↓
Paid → Confirmation
Pending → Processing
Failed → Payment issue
```

This prevents false success/failure displays.

---

## 28. Entitlement Creation

Paid purchases should result in entitlements through trusted server-side processing.

```text
Paid Order
    ↓
Purchased Product(s)
    ↓
Entitlement Rules
    ↓
Customer Entitlements
    ↓
Academy / Booking / Resources
```

Entitlement creation must be idempotent.

### 28.1 What an order grants, and whether it may be sold (migration 0012)

```text
group coaching     the one-session product: a seat of its series (products.series_id),
                   spent at once on the session named on the order line (0022); left
                   on the account, for that series and valid_months, only if that
                   session had filled
                   the eight-session product: a place on a run of its series (series_pass),
                   and the buyer is registered for the run at once where there is one (0016)
private coaching   sessions of the service sold by the product, or by its pack_of product
membership         one-time price: a year's membership entitlement
                   recurring price: nothing here — granted from the subscription
cohort             a place on one intake (a counted entitlement), and the buyer is put on
                   the intake at once where there is exactly one open (0017)
course, retreat,   access to the one thing the product sells; a retreat product with no
event              retreat behind it grants nothing
bundle             nothing (no fulfilment rule exists); bundle products are paused
```

**Why it can't be bought, said right (migration 0022, 2026-10-23).** `coaching_sale_status`
answers `ended` for a retreat or cohort whose every batch or intake has finished (it used to
say "no date yet"); for a series with no run still to start, `past` while one is under way and
`unscheduled` when there is none (it used to say registration "closes on the date shown on its
page"); and `unscheduled` for a single session whose series has no run to come. The refusals
themselves are unchanged. A retreat page whose batches have all run says "Last ran …" with a
"Finished" chip.

**Buying again (owner, 2026-10-08).**

```text
course             bought once, kept for life; cannot be bought again
cohort             one place on one intake; cannot be bought again while that intake runs.
                   The next intake is a new purchase of the same product (0017).
retreat            one place; cannot be bought again. Each running is its own row and product.
group coaching     sessions are for one series and lapse three months after purchase
                   (single or pack); "still to use" is asked per series
private coaching   sessions lapse six months after purchase (single or pack)
                   For both: more can be bought once every session held is used or has
                   lapsed, whichever comes first.
membership         one payment for twelve months (owner, 2026-10-09). The same tier or a
                   lower one cannot be bought while more than thirty days remain; inside
                   the last thirty it can, and the new year is added to the end of the one
                   held. A HIGHER tier is an UPGRADE (owner, 2026-10-10, migration 0027):
                   the difference between the two prices, while at least four months of
                   the pass remain; the same pass then becomes the higher tier for the
                   rest of its own year (same end date), with what that tier adds. With
                   less than four months left it waits for the renewal window. A
                   membership still renewing as a subscription must be cancelled first.
```

An upgrade is decided and priced in one place, `lib/commerce/pass-upgrade`: `applyPassUpgrades`
rewrites the priced line (the difference, no Stripe price, `upgradeFrom` = the pass's
entitlement) for the cart, the checkout page and the checkout action alike; the order line
carries `metadata.upgrade_from`, and `grant_entitlements_for_order` changes that entitlement's
tier in place and grants nothing new.

The membership rule is asked in the application, not by `coaching_sale_status`:
`saleCheck` (`lib/commerce/sale-check`) is the one function the cart, the checkout page and
the checkout action call for every line, and it answers membership from `my_membership` and
everything else from the database function.

**Listing by time (owner, 2026-10-08).** For cohorts, retreats and events alike:

```text
upcoming       listed; can be joined once it has a date
in progress    listed and marked "in progress"; closed to new people
ended          off the coaching listings (its own page still resolves for those in it);
               an ended event moves to the events page's "Past events"
```

"Ended" is `ends_at`. Where none was entered, a cohort is taken to run twelve weeks, a
retreat one day and an event three hours, so a row with no end is never listed for ever.

`coaching_sale_status(product)` is asked of EVERY line by checkout before any order is
created, by the checkout and cart pages (which say so in place of the form), and by the
product pages to word their buttons: `owned`, `unused` (paid for and not yet used), `closed`
(a Group Coaching series with no run open for registration), `ok`, `full` (capacity as set in admin), `unscheduled` (a
cohort or retreat with no date), `past` (it has begun), `application` (a level entered by interview, and no approved
application), `unavailable`.

---

## 29. Booking Architecture

A booking represents a specific scheduled participation.

General flow:

```text
Customer
   ↓
Select service/session
   ↓
Check eligibility
   ↓
Check entitlement where applicable
   ↓
Check availability
   ↓
Check capacity
   ↓
Create booking
   ↓
Confirmation
```

The server must be authoritative for eligibility and availability.

---

## 30. Booking Eligibility

Before creating a booking, the server must validate:

```text
Authenticated customer
+
Service eligibility
+
Entitlement where required
+
Availability
+
Capacity
+
Booking rules
```

Client-side availability is for user experience only.

---

## 31. Group Coaching Booking

Group Coaching follows:

```text
Membership / Direct Purchase
       ↓
Group Coaching Entitlement
       ↓
Series / Session
       ↓
Availability
       ↓
Booking
```

The booking system must confirm that the customer has the correct entitlement or purchase eligibility.

---

**How a seat is held (migrations 0016, 0018), tried in this order:** being registered for
the run the session belongs to — by a paid place, or by a member against their tier's number
for the year (note 07 §12.1) — in which case the seat is theirs already and asking to book
returns `enrolled` and spends nothing; standing access to the series (a series granted
outright); a session credit for that series, the one that lapses soonest first. Only the
last is counted down. The term-choice route of migration 0013 is removed.

## 32. Group Coaching Capacity

The existing Group Coaching offering has:

```text
Maximum group size: 8
Session length: 1 hour
```

Capacity should be configured as data rather than hard-coded throughout the UI.

The database must prevent concurrent requests from exceeding capacity.

---

## 33. Session Entitlement Consumption

Where a customer has a limited entitlement:

```text
8 sessions
```

a valid booking may consume one session according to the business rules.

Consumption must be atomic.

Example:

```text
Remaining = 1

Request A ──┐
            ├── Transaction → only one successful consumption
Request B ──┘
```

This prevents double use.

---

## 34. Booking Cancellation

Booking cancellation must distinguish:

```text
Booking cancelled
```

from:

```text
Entitlement permanently consumed
```

If the business rules allow a session credit to be returned after timely cancellation, that adjustment must occur transactionally.

The cancellation window should be configurable.

---

## 35. Rescheduling

Where rescheduling is supported:

```text
Existing booking
      ↓
Validate cancellation/reschedule rules
      ↓
Check new availability
      ↓
Update booking
```

The system must avoid temporarily or permanently exceeding capacity during the operation.

---

## 36. Private Coaching

Private Coaching is a separate service category.

Conceptually:

```text
Private Coaching Service
        ↓
Purchase / Eligibility
        ↓
Availability
        ↓
Booking
```

Membership access to Private Coaching exists only where the relevant membership entitlement explicitly provides it.

**Implementation status (2026-09-27, migration 0020; pay first, then book since the owner's
decision of 2026-10-08).** Slots are set in Admin. A session is paid for before a time is
chosen, for one session and for a pack alike:

```text
Checkout — one session or a pack, like any product   /checkout?product=…
   ↓
Webhook → fulfil_order → `private_coaching` entitlement (one per session bought)
   ↓
Choose a time — signed in, holding a session         /book/private/[serviceSlug]
   ↓
bookPrivateSlotAction spends one session → booking confirmed
```

Until 2026-10-08 a single session was book-first instead (hold a slot, then pay, with the
booking confirmed from the order's entitlement). `bookPrivateSlotAction` now books only
against a held session and creates no checkout. `hold_private_coaching_slot` can still return
a hold for a caller with none (the function is unchanged); the action releases it at once.

- **Slots** (`private_coaching_slots`) belong to one service. A time overlapping any live
  booking of any service is hidden (Tony cannot be in two sessions). At least 12 hours'
  notice. Times reach customers only through `private_coaching_availability`; the table,
  which carries the call link, is readable by staff and by the person who booked it.
- **Holds** (`bookings.hold_expires_at`, `bookings.order_id`, `release_private_coaching_hold`)
  remain from the book-first flow with nothing left to hold: no checkout creates one.
  `private_coaching_rebook` (the email for a held time lost before payment landed) is
  likewise kept but no longer sent by this flow.
- **Credits** — unspent sessions — book outright with no payment. They come from a
  purchase not yet given a time, a cancellation made at least 48 hours ahead, or staff
  cancelling a booked slot (always returned, customer emailed). Inside 48 hours
  `cancel_booking` refuses (`too_late`) and the customer is pointed to contact.
- **Buying needs no account;** a guest pays with an email like any one-off purchase (§4).
  Choosing a time needs a signed-in account holding a session, so a guest claims the
  order first (note 05 §29.3).
- Membership inclusion of private coaching is still not modelled, per the rule above.


## 37. Cohort Registration

Interactive Cohorts remain distinct from Group Coaching.

A typical flow is:

```text
Eligible Customer
      ↓
Cohort Entitlement / Purchase
      ↓
Registration
      ↓
Workshop participation
```

Ultimate Membership includes unlimited Interactive Cohort access subject to the operational rules of the individual cohort.

---

## 38. Events

Events are first-class offerings.

Possible flow:

```text
/events
   ↓
/events/[slug]
   ↓
Register / Book
   ↓
Payment if required
   ↓
Confirmation
```

An event may be:

- Free
- Paid
- Capacity-limited
- Membership-accessible
- Invitation-only

The event configuration determines the applicable flow.

---

## 39. Retreats

Retreats may require a more controlled workflow:

```text
Application
   ↓
Interview / Selection
   ↓
Approval
   ↓
Payment
   ↓
Registration
   ↓
Attendance
```

Not every retreat must use every stage.

The architecture should support different retreat workflows without forcing every retreat into the same flow.

---

## 40. External Services

The planned external services include:

```text
Supabase
Stripe
Brevo
Livid
Vercel
GitHub
```

The division of responsibility is fixed:

```text
Vercel / Next.js   Application server, Stripe webhooks, payment and business
                   logic, entitlement creation, Vercel Cron scheduling
Supabase           PostgreSQL, Auth, Row Level Security, Storage
Stripe             Payment processing, Checkout, subscriptions, invoices
Brevo              Transactional email and communication
Livid              Video hosting and streaming, public and private
GitHub             Source control and migration history
```

Stripe webhook handling and payment/business logic stay in the Next.js/Vercel server layer.
Supabase is the database, identity and storage layer — not a second application server.
Vercel Cron is the primary scheduler.

No workflow is implemented in both Vercel and Supabase.

Each integration must have a clearly defined responsibility and server/client boundary.

Additional services may be added later without changing the core commercial model.

## 40.1 Livid — Video

All video is hosted on Livid, both public site video and gated Academy video. None is
held in Supabase Storage: object storage does not transcode or serve adaptive bitrate,
so a single upload would be served at full size to a phone on mobile data.

**Vimeo is the interim host for gated lesson video** while the Livid account is set up
(R29, decided 2026-09-05). This is a hosting decision and not an architectural one,
because a lesson stores a PROVIDER AND AN ID rather than a URL (note 07 §34.1): moving to
Livid is an update of two columns. The paragraph below applies to Vimeo word for word —
its domain restriction likewise cannot tell our own members apart.

Videos are uploaded in Livid and their URLs recorded against the relevant entity. The
platform stores the reference and never proxies the stream.

**Domain restriction is Livid's control, not ours, and it does not distinguish between
our own customers.** A domain allowlist stops another site embedding the player; it does
nothing to stop a Silver member watching Platinum content, because both are on our
domain. The entitlement check must therefore happen the same way it does for every other
gated resource: **the URL is withheld server-side unless the entitlement passes.** A
video URL rendered into a page that any signed-in user can load is a video available to
every signed-in user, whatever the allowlist says.

Two operational consequences of the domain lock, to be confirmed against the account
before Academy video is built:

- **Local development.** If `localhost` is not allowlisted, video cannot be played
  while developing.
- **Preview deployments.** Vercel preview URLs are generated per deployment, so a
  fixed allowlist cannot cover them. Either a wildcard is available for the preview
  domain, or video is verified only on production and local.

**Livid exposes no API.** Confirmed 2026-09-03. Getting a video onto Livid is a manual
dashboard upload, with no scripted or programmatic path — not for this platform's own
ingestion, and not for bulk migration from another source. This is permanent for any
content-management workflow built around Livid, not just the initial Wix migration:

```text
Video file
   ↓
Manual upload via the Livid dashboard   ← no automation possible here
   ↓
Livid reference (URL) copied out
   ↓
Recorded against the relevant entity, by a person, through Admin
```

Consequently, no Admin screen can offer an in-app "upload video" control that finishes
the job itself. The Admin video-attaching flow is necessarily two-step: upload to Livid
outside the application, then paste the resulting reference into the entity's Admin
form. Any future bulk content import (this Wix migration included) treats every video
as a manual hand-off point rather than something a script can carry end-to-end.

---

---

## 41. Brevo

Brevo is used for appropriate email and communication functions.

Potential uses include:

- Transactional emails
- Email templates
- Customer communications
- Mailing lists
- Contact synchronization
- Appropriate email-list operations

Brevo API credentials must remain server-side.

## 41.1 Authentication Email

Supabase's built-in email sender is rate limited — the default local configuration permits
**two messages per hour** — and is explicitly not intended for production traffic.

Since email confirmation is now required in every environment (note 05 §10) and magic-link
sign-in delivers the credential itself by email, authentication mail is on the critical
path of both registration and sign-in. It therefore cannot depend on the built-in sender.

Brevo is configured as the SMTP provider for Supabase Auth, so confirmation, magic-link and
recovery messages are sent through the same provider as the rest of the platform's email.

**Local deliberately does not use Brevo.** Development mail is captured by Mailpit and
never leaves the machine. Routing it through Brevo would send real email on every test
signup, burn quota, and risk mailing a real person from a fixture. The flows — confirmation,
magic link, recovery — are exercised identically either way; only the transport differs.

This is the one place where local and production configuration diverge on purpose.

Without this, the failure mode is silent and badly timed: registrations succeed while the
confirmation mail is quietly dropped for exceeding a quota nobody was watching.

---

## 42. Transactional Email

Business events may trigger emails such as:

```text
Order confirmation
Payment confirmation
Membership activation
Membership renewal
Booking confirmation
Booking cancellation
Course access
Account notices
```

The set actually implemented, each with its idempotency key:

```text
welcome               welcome:<user>            first successful sign-in (note 05 §7.3)
order_receipt         receipt:<order>           payment captured
membership_activated  membership:<subscription> subscription created and paying
guest_claim           claim:<order>             guest purchase awaiting an account
booking_confirmed     booking:<id>              place reserved
booking_cancelled     booking:<id>              place released
```

`membership_activated` is sent on subscription **creation** only, and only once the
subscription is actually paying. A renewal is not an activation, and a subscription still
settling its first payment may never activate at all — announcing either would be wrong.

Email is not the source of truth for these events.

For example:

```text
Booking exists in database
+
Email delivery temporarily fails
=
Booking still exists
```

Email delivery can be retried independently.

**Every paid order gets a receipt, and one place sends it** (2026-10-23). `notifyPaidOrder`
(`lib/commerce/notify`) is called by the Stripe webhook and by reconciliation alike: an order
with no account yet (guest or gift) gets the claim link at the order's own email (the
recipient, for a gift), and whoever paid always gets `order_receipt`. Guest and gift buyers used
to get no receipt, and reconciliation, holding its own copy of this code, sent a recovered
gift's claim link to the payer. A retreat applicant now gets `retreat_application_sent` when
they apply, as well as the email when accepted.

## 42.1 Outbox

Sending is decoupled from the event that causes it. The business transaction writes a row
to an outbox and commits; delivery happens afterwards, driven by a scheduled job.

```text
Business event (order paid, booking made)
        ↓  same transaction
Outbox row committed
        ↓  later, and retryable
Provider send
```

Three things follow, all of them consequences of email not being the source of truth:

- **A provider outage cannot fail a purchase.** If Brevo is unreachable, the order is still
  paid and the entitlement still granted; only the receipt waits.
- **The webhook stays fast and cannot be made to retry by an email failure.** Blocking a
  Stripe webhook on a third party invites a redelivery of work already completed.
- **Every message carries an idempotency key** derived from the event — `receipt:<order>`,
  `claim:<order>`, `booking:<id>`. A redelivered webhook queues nothing new, so a customer
  cannot receive two receipts for one payment (§56).

Failures are retried with exponential backoff and abandoned after five attempts. The row is
kept either way, so an undelivered message is visible rather than lost.

## 42.2 Non-production sending

The Brevo account carries assets belonging to Tony Klinger Online Coaching, one of the
legacy sites being merged into this platform. Those templates, lists and contacts predate
this project and must not be altered or reused — they describe a different product. This
platform creates and uses **its own**, and the separation is enforced in code rather than
by convention:

**No user, order, subscription or entitlement migration is needed from Tony Klinger Online
Coaching.** Confirmed directly by the user (2026-09-03, closing reconciliation item R27):
that platform never had real paying customers. Its relevance to this project is as a
source of copy, content and product ideas to draw from during content migration — and,
per this section, of legacy Brevo assets that must not be altered or reused — not as a
system whose customer or commercial records need to be carried across.

- Brevo is opt-in. Without `EMAIL_TRANSPORT=brevo` nothing reaches it, and an unconfigured
  production environment sends nothing at all rather than defaulting to live delivery.
- Only the transactional send endpoint is called. No contact, list, folder or template write
  API is reachable from the email module, so the other project's data cannot be altered from
  this codebase.
- Outside production, recipients must match an allowlist. A non-matching address is refused
  with a recorded reason, never silently dropped — a silent no-op here would surface later
  as a delivery bug.
- **Reserved test domains are never sent through Brevo, in any environment** (2026-10-24,
  owner). `.local`, `.test`, `.example`, `.invalid`, `.localhost` and `example.com/.net/.org`
  have no real recipients; the sample accounts are `@test.local`. On Vercel (production
  mode, allowlist off) their tickets and welcomes were queued for Brevo, to bounce against
  the sender the real site shares. Such a message is set to `cancelled` with the reason
  "test address (reserved domain), not sent". Mailpit still receives them locally.

## 42.3 Templates and lists

This platform owns its Brevo assets outright. Every one is prefixed `TK.com — ` so it is
unmistakable against the legacy assets in the same account, and none of the legacy ones is
read, edited or sent.

**Templates are resolved per message, not all-or-nothing.** A template id supplied through
the environment is used; where none is configured the message is rendered from the
version-controlled HTML instead:

```text
BREVO_TEMPLATE_<NAME> set   →  Brevo template, with params
BREVO_TEMPLATE_<NAME> unset →  HTML rendered from src/lib/email/templates.ts
```

The rendered HTML is **always** sent alongside the template id. Two reasons: local
development uses Mailpit, which cannot render a Brevo template and would otherwise show an
empty message; and a template later deleted in the dashboard degrades to HTML rather than
sending nothing. A non-numeric id falls back to HTML rather than reaching Brevo as garbage
and failing every message of that type.

**Layout in Brevo, wording in the code (2026-10-24, owner).** Every template is the same
layout (`src/lib/email/layout.mjs`) with four slots — `subject`, `title`, `body`,
`site_url` — and `brevoParams` fills them with exactly what the site would send itself.
The look can be restyled in the Brevo dashboard; the words cannot go stale there. This
replaced per-template variables, which had to be kept in step with the copy by hand and
had drifted (the September templates still said "membership" and had no gift wording).

- `body` is inserted with `{{ params.body | safe }}`. Checked against Brevo with a real
  send: plain `{{ params.x }}` is HTML-escaped, `| safe` is not — so the site escapes
  everything a visitor typed before it gets there (contact enquiry, welcome name and
  session titles were found unescaped in the same check and fixed).
- `pnpm brevo:templates` creates or updates one template per site email, matched by name
  (`TK.com — …`), so ids never change; `--write <env file>` records the ids. It is the only
  code that writes templates, it touches only `TK.com — ` names, and it lives in `scripts/`,
  not in the email module (§42.2 still holds there).
- Ids (shared Brevo account, so the same for test and production): Welcome 21, Order
  receipt 22, Membership activated 23, Guest claim 24, Booking confirmed 25, Booking
  cancelled 26, Contact enquiry 27, Event ticket 29, Event place available 30, Event
  reminder 31, Event starting soon 32, Session reminder 33, Session starting soon 34,
  Coaching Pass ending 35, Private coaching rebook 36, Verification method removed 37,
  Account already exists 38, Retreat application received 39, sent 40, approved 41,
  closed 42.

Contact lists are separate from transactional email and are not written by the application:

```text
TK.com — Newsletter    marketing consent, opt-in
TK.com — Customers     has bought at least once
TK.com — Members       holds an active membership
TK.com — Enquiries     contact-form submissions
```

Newsletter welcome is Brevo automation against the Newsletter list. That is a different
event from the platform welcome in note 05 §7.3, which follows first sign-in and is sent
transactionally — subscribing to a newsletter and creating an account are not the same act,
and one does not imply the other.

---

---

## 43. Email Synchronization and Cleanup

Email-list synchronization/cleanup is a background concern where it is not directly triggered by the UI.

Examples:

```text
Remove deleted customer from appropriate marketing list
Synchronize communication preferences
Process suppression/unsubscribe state
Reconcile Brevo contacts
```

These operations must not delete core commercial records merely because a contact is removed from an email list.

---

## 44. Background Processing

Some processes are not directly initiated by a UI.

Examples:

- Stripe webhook processing
- Subscription reconciliation
- Email synchronization
- Email retry
- Scheduled maintenance
- Temporary checkout cleanup
- Temporary claim-token cleanup
- Expired entitlement state transitions
- Other database maintenance

The scheduled jobs as implemented:

```text
send-emails          every 5 minutes    deliver queued messages (§42.1)
reconcile-stripe     every 15 minutes   fulfil orders Stripe says were paid (§46)
expire-entitlements  hourly             transition lapsed access to expired
cleanup-tokens       daily              remove spent one-time tokens
cleanup-uploads      daily              remove Media uploads never saved (2026-10-15)
sync-audiences       daily              reconcile the Members email list with who holds access
sync-stripe          hourly             mirror products and prices to Stripe (§12.1)
event-reminders      every 15 minutes   event tickets: day-before reminder, link again at the start
session-reminders    every 15 minutes   coaching sessions: the same two reminders (2026-10-16)
pass-reminders       daily              "your Coaching Pass ends soon", a month and a week before
```

The schedules live in `vercel.json.test` until it becomes the production `vercel.json`
(`docs/deployment.md`).

`session-reminders` covers Group Coaching sessions, private sessions, cohort workshops, the
members' Q&A and retreat batches. The recipients come from `session_reminders_due`, which
mirrors the rules that show each session in the Academy (a booking or a run registration; a
place on the intake or standing cohort access; a pass whose tier includes the Q&A; a retreat
place or a pass covering a retreat with no interview), so the email reaches exactly the
people who can open the session. The "starting soon" email goes only when the session has a
joining link, since handing over the link is its purpose. Keys are per kind, session and
person.

`pass-reminders` exists because a Coaching Pass is one payment and does not renew (§16.1):
`passes_ending_due` returns passes ending in 8 to 30 days (buying the next year is open,
`RENEWAL_WINDOW_DAYS`) and within 7, leaving out anyone who has already bought the next
year, passes on a subscription that will renew, and grants shorter than 60 days.

`reconcile-stripe` fulfils through the same `fulfil_order` the webhook uses, so a reconciled
order is indistinguishable from a normally processed one, and racing a late webhook is
harmless. It never marks an order paid on its own judgement — it asks Stripe and replays the
authoritative answer.

`cleanup-tokens` removes credentials, never commercial records. The paid order a token
pointed at outlives every token issued for it (§45).

`cleanup-uploads` deletes files under `uploads/` in `site-media` and `private-media` that are
more than a day old and that no Media item (`resources.storage_path`) names: uploads whose
form was cancelled or closed before saving. It looks nowhere else, so files imported before
launch are never in its reach (note 08 §26).

**Vercel Cron is the single primary scheduler.** Scheduled jobs invoke secured Next.js Route
Handlers under:

```text
/api/cron/[job]
```

The rules:

- **Each scheduled route is authenticated.** A cron endpoint is a public URL. It must verify
  a shared secret or the platform's cron signature before doing anything, and must never be
  invocable by an anonymous request.
- **The route is a thin entry point.** The work itself lives in `src/lib`, so the same
  operation can be invoked by a schedule, a webhook, a reconciliation run or an admin action
  without being written more than once.
- **Every job is idempotent and safely re-runnable.** A schedule can fire twice, overlap a
  previous run, or retry after a failure.
- **One implementation per job.** Supabase Cron is not introduced as a competing scheduler.
  A job that runs on Vercel Cron does not also exist as a Supabase Edge Function.

### Test deploy: Google Apps Script stands in for Vercel Cron

*Recorded 2026-10-23, scheduler changed 2026-10-24 (owner).* While the test deploy is on
Vercel Hobby, which allows a cron only once a day, a Google Apps Script project
(`scripts/apps-script/scheduled-jobs.gs`, run from the owner's Google account) calls the
same `/api/cron/[job]` routes with the same `CRON_SECRET`, kept in its Script Properties.
It is a temporary deviation from "Vercel Cron is the single scheduler", not a second
implementation: the jobs and routes are unchanged, and its triggers are removed when the
project moves to Pro and `vercel.json.test` becomes `vercel.json`. Both must never run
against the same deploy.

Its schedules follow `vercel.json.test`, so a new job is added to both until launch. Apps
Script cannot offset a trigger within the hour, so session reminders run on the quarter
hour rather than at :05/:20/:35/:50, and daily jobs run somewhere within their hour; every
job catches up on outstanding work, so neither matters. It replaced a GitHub Actions
workflow, which GitHub started late and mostly skipped (14 runs in about eight hours
against roughly 22 asked for each hour).

Supabase remains the database, Auth, RLS and Storage layer. PostgreSQL triggers and
constraints are still used where the guarantee genuinely belongs in the database (note 08
§57), which is a different thing from scheduling application work.

Do not depend on users visiting a page to trigger essential maintenance.

---

## 45. Paid Orders Must Never Be Cleanup Targets

A paid unclaimed order is a real commercial record.

Therefore:

```text
Paid unclaimed order
≠
Abandoned checkout session
```

Cleanup jobs may remove genuinely abandoned temporary checkout/session data.

They must never delete a paid order merely because the customer has not yet created or claimed an account.

Likewise:

```text
Expired entitlement
```

should normally transition to an expired/inactive state rather than being deleted when historical retention is required.

### Unfinished checkouts are closed, not deleted

*Recorded 2026-10-23 (owner).* An order whose checkout was never finished is marked
`cancelled`, shown to the customer as **"Not completed"**, never deleted
(`cancelUnfinishedOrder`, which touches only a still-pending order, so a payment that lands
first always wins):

```text
checkout.session.expired (unpaid)            webhook, as it happens (Stripe closes the page 24 h after it opens)
reconcile-stripe: session expired            catches an event that was missed
reconcile-stripe: session gone from Stripe   it can never be paid (e.g. a test-mode reset)
reconcile-stripe: no session, over 24 h      the payment page was never made (Stripe unreachable)
```

Left pending, these piled up for ever, and since `orders_awaiting_reconciliation` returns the
oldest hundred pending orders, enough of them would have kept the job from ever reaching a
paid order whose webhook was lost. Nothing else changes for the customer: nothing was charged,
the cart is kept, and buying again makes a new order.

---

## 46. Reconciliation

External systems can become temporarily inconsistent with the application.

The architecture should support reconciliation.

Example:

```text
Stripe payment exists
        ↓
Webhook was delayed/missed
        ↓
Reconciliation detects mismatch
        ↓
Trusted Stripe state processed
        ↓
Order / membership / entitlement updated
```

The reconciliation process must also be idempotent.

---

## 47. External-Service Failure Handling

Assume external services can fail.

Examples:

```text
Stripe timeout
Brevo unavailable
Webhook delayed
API rate limit
Network failure
```

The system should use appropriate:

- Retry handling
- Status tracking
- Idempotency
- Logging
- User-friendly error states
- Reconciliation

Retries must be bounded and must not create duplicate side effects.

---

## 48. Integration Logging

Important integration failures should be observable.

Examples:

```text
Stripe webhook processing failed
Brevo synchronization failed
Payment reconciliation failed
Email request failed
```

Logs must not expose:

- API secrets
- Passwords
- Full card information
- Unnecessary sensitive customer data

---

## 49. Secrets

External-service secrets remain server-side.

Examples:

```text
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
BREVO_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

Never expose these through:

- Client Components
- Public source files
- Browser-accessible environment variables
- Git repositories

---

## 50. Server Actions and Route Handlers

Use Server Actions for appropriate UI-triggered mutations.

Examples:

```text
Create booking
Cancel booking
Account mutation
Admin mutation
```

Use Route Handlers where an HTTP endpoint is required.

Examples:

```text
/api/stripe/webhook
/auth/callback
External integration callbacks
```

Do not use a Server Action as a public webhook endpoint.

Do not create a Route Handler merely when a Server Action is sufficient.

---

## 51. Integration Boundaries

External service calls should have clear server-side boundaries.

Conceptually:

```text
UI
 ↓
Next.js Server
 ↓
Domain / Business Operation
 ↓
External Service
 ↓
Database
```

Do not scatter direct Stripe or Brevo calls throughout React components.

Integration logic should be centralized in appropriate server-side modules.

---

## 52. Payment Security

The Tony Klinger application should not store raw payment-card information.

Prefer Stripe-hosted or Stripe-supported secure payment interfaces.

The application must never store:

- Full card numbers
- Card security codes

Stripe should handle sensitive card-processing responsibilities.

---

## 53. Booking Security

Booking operations must be server-authoritative.

The server must validate:

- Customer identity
- Service
- Entitlement
- Availability
- Capacity
- Existing booking conflicts
- Booking time
- Cancellation/rescheduling rules

The browser may request a date/time, but the server decides whether the booking is valid.

---

## 54. Payment-to-Booking Relationship

Payment does not automatically mean a booking exists.

Example:

```text
Membership
 ↓
Entitlement
 ↓
Customer selects session
 ↓
Booking
```

Or:

```text
Private Coaching purchase
 ↓
Eligibility
 ↓
Booking
```

Therefore:

```text
PAYMENT ≠ BOOKING
```

---

## 55. Payment-to-Academy Relationship

Payment does not directly grant arbitrary Academy access.

The trusted relationship is:

```text
PAYMENT
 ↓
ORDER
 ↓
ENTITLEMENT
 ↓
ACADEMY ACCESS
```

The entitlement layer remains the access-control bridge.

---

## 56. Integration Idempotency

Important operations must be safe to retry.

Examples:

```text
Stripe event processing
Entitlement creation
Brevo contact synchronization
Important transactional email request
Booking creation
```

Use appropriate idempotency keys, unique constraints or processed-event records.

---

## 57. Failure Recovery

A failed external operation must leave the application in a recoverable state.

Example:

```text
Payment succeeds
 ↓
Webhook processing fails temporarily
 ↓
Order remains identifiable
 ↓
Retry / reconciliation
 ↓
Entitlement eventually created
```

The system must not permanently lose the relationship between payment, order and customer.

---

## 58. Technology Requirement

Use the latest stable, production-safe versions of:

- Next.js
- React
- TypeScript
- Stripe SDK
- Supabase SDK
- Brevo integration/API
- Other project dependencies

Before implementation, verify the current official documentation and recommended APIs.

Do not build payment/webhook logic from outdated tutorials.

---

## 59. Overall Commercial Model

```text
                    PRODUCT
                       ↓
                     PRICE
                       ↓
                CART / CHECKOUT
                       ↓
                 ┌─────┴─────┐
                 │           │
              GUEST      SIGNED-IN
                 │           │
                 └─────┬─────┘
                       ↓
                     ORDER
                       ↓
                    STRIPE
                       ↓
                PAYMENT EVENT
                       ↓
                    WEBHOOK
                       ↓
                ORDER CONFIRMED
                       ↓
                  ENTITLEMENT
                       ↓
          ┌────────────┼────────────┐
          │            │            │
       ACADEMY      BOOKING      RESOURCES
```

---

## 60. Architecture Principle

The Payments, Bookings & External Services architecture must provide:

**Secure server-side payment processing, guest and signed-in checkout, authoritative Stripe confirmation, idempotent webhook handling, explicit entitlement creation, reliable booking validation, resilient external integrations, secure secrets handling and recoverable background processing.**

The system must preserve the distinction between:

```text
PAYMENT
ORDER
ENTITLEMENT
BOOKING
```

at every stage of the customer and administrative workflows.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1); box-drawing characters, arrows and `≠` restored, and the §33 concurrency diagram and §59 commercial-model diagram re-aligned. No wording was altered. |
| 2026-08-28 | **Header corrected.** The supplied `**File:**` line read `07-payments-bookings-and-external-services-architecture.md`. Note 07 is the Products, Memberships & Academy Architecture, and this note is ninth in the sequence, so the line was corrected to `09-...` to match the document's own filename and prevent two notes claiming number 07. |
| 2026-08-28 | §40: division of responsibility between Vercel/Next.js, Supabase, Stripe, Brevo and GitHub recorded explicitly — Stripe webhooks and payment/business logic in the Next.js/Vercel layer, Supabase as PostgreSQL/Auth/RLS/Storage, no workflow implemented in both. |
| 2026-08-28 | §44: Vercel Cron named as the single primary scheduler, invoking authenticated Route Handlers under `/api/cron/[job]` that wrap shared `src/lib` operations; every job idempotent, one implementation per job, Supabase Cron not adopted. Closes R22. |
| 2026-08-29 | §41.1 (new): Brevo recorded as the SMTP provider for Supabase Auth email. The built-in sender is rate limited (two per hour by default) and cannot carry confirmation and magic-link mail, which are now on the critical path of registration and sign-in. |
| 2026-08-30 | §41.1: recorded that local mail stays on Mailpit while production uses Brevo SMTP — the deliberate exception to matching local and production configuration. |
| 2026-08-31 | §42.1, §42.2 (new): email outbox recorded — queued in the business transaction, delivered by a scheduled job, idempotency-keyed per event, retried with backoff. Non-production sending constrained in code because the Brevo account is shared with a live client project: Brevo opt-in only, transactional endpoint only, recipient allowlist outside production. |
| 2026-08-31 | §44: the implemented cron schedule recorded — send-emails, reconcile-stripe, expire-entitlements, cleanup-tokens — with the note that reconciliation replays Stripe's answer rather than deciding for itself, and that token cleanup never touches commercial records. |
| 2026-09-02 | §42: the implemented message set recorded with its idempotency keys, including `welcome` (note 05 §7.3) and `membership_activated`; the latter fixed to subscription creation only, and only once the subscription is actually paying — a renewal is not an activation. |
| 2026-09-02 | §42.2 corrected. The note described the Brevo account as shared with a *live client project*; it is not. It holds assets from Tony Klinger Online Coaching, a legacy site being merged into this platform, which must not be altered or reused because they describe a different product. |
| 2026-09-02 | §42.3 (new): this platform's own Brevo templates and lists recorded, all prefixed `TK.com — `. Template-first with HTML fallback resolved per message; HTML always sent alongside so Mailpit still renders locally and a deleted template degrades rather than sending nothing. Parameter names recorded as the contract, since a mismatch is silent. |
| 2026-09-02 | §40, §40.1 (new): Livid recorded as the video host for all video, public and gated; Supabase Storage explicitly excluded, since object storage neither transcodes nor serves adaptive bitrate. Recorded that Livid's domain restriction does not distinguish between our own customers, so a gated video URL must be withheld server-side on the entitlement check exactly as any other gated resource is. Local and preview-domain allowlisting flagged as open questions. |
| 2026-09-05 | §40.1: Vimeo recorded as the interim host for gated lesson video per the owner's decision on R29, with the note that this is a hosting choice rather than an architectural one — a lesson stores a provider and an id, so the move to Livid is a data change. The domain-restriction argument applies unchanged to Vimeo, and the operational requirement to switch that restriction on per video is recorded in the R29 row. |
| 2026-09-27 | §19, §36: private coaching booking implemented (migration 0020) — Admin-set slots, a 35-minute hold, Stripe Checkout limited to 30 minutes, fulfilment confirming the hold through a `private_coaching` entitlement, credit fallback when the held time is lost, 48-hour cancellation returning the session. `checkout.session.expired` added to the handled webhook events. |
| 2026-09-27 | §17, §19: billing self-service (migration 0021) — one Stripe Customer per account, Customer Portal for card changes, invoices and at-period-end cancellation (settings in `scripts/stripe-portal-setup.mjs`, plan switching off), on-site resume, receipts for one-off payments and invoices for subscriptions; `invoice.*` events recorded. |
| 2026-09-27 | §17: memberships can be cancelled on the site (confirmation dialog, reason sent to Stripe as `cancellation_details`) as well as in the Stripe portal (owner). |
| 2026-10-08 | §8.2 (new), §16.1, §28.1 (new): option and billing switches in the cart and at checkout; `/checkout?product=`; quantity held at one for products held by one person; membership access granted from the subscription and from a one-time purchase; what each product type grants; `coaching_sale_status`. Migration 0012. |
| 2026-10-08 | §8.2, §16.1, §28.1, §31: one of each per order and no repeat add; yearly membership as a renewing subscription; `coaching_sale_status` asked of every line (`owned`, `unused`), buying-again rules, and listing by time; the three ways to hold a Group Coaching seat, with a member's term choice. |
| 2026-10-09 | §28.1, §36: Group Coaching sessions are granted for, and spent on, the series of the product that sold them (migration 0014); private coaching is pay first, then book. |
| 2026-10-09 | §28.1, §31: series runs — a place on a run granted and registered on payment; Group Coaching sold only while a run is open for registration (`closed`, `full`); being registered for a session's run as a way of holding a seat. Migration 0016. |
| 2026-10-10 | §28.1: a higher pass is an upgrade for the difference in price while four months remain, changing the tier of the same pass (migration 0027, `lib/commerce/pass-upgrade`). |
| 2026-10-09 | §28.1: one Group Coaching session is bought for a date and booked on fulfilment (`order_items.metadata.session_id`, `session_sale_status`, `book_session_for`, migration 0022); one run of a series open at a time (0021). |
| 2026-10-09 | §16.1, §28.1: membership sold only as one payment for twelve months; recurring prices retired; buying-again rule for membership and `saleCheck`. |
| 2026-10-09 | §28.1: a cohort is sold only while one of its intakes is open for registration, and its price buys a place on that intake (migration 0017). |
| 2026-10-24 | §42.2: messages to reserved test domains are cancelled, not sent, whenever the transport is Brevo (sample accounts on the test site); Mailpit unaffected. |
| 2026-10-24 | §42.3: Brevo templates are one shared layout filled with the site's own wording (`subject`, `title`, `body` with `| safe`, `site_url`), replacing per-template params. All 21 created/updated by `pnpm brevo:templates` (ids 21–27, 29–42). Visitor-typed text in the contact enquiry and welcome emails now escaped. **Flag:** note 01 says templates should be managed in Brevo rather than duplicated in the application — the wording now lives in the application and the look in Brevo; recorded as a deliberate reading, not silently resolved. |
| 2026-10-14 | Email `retreat_application_closed`: sent when staff decline or withdraw a retreat application, one wording for both, with the optional staff note; once per closing (idempotency key carries `closed_at`). Optional Brevo template `BREVO_TEMPLATE_RETREAT_APPLICATION_CLOSED`. |
| 2026-10-15 | §12.1 (new): the catalogue mirror described; a product renamed or re-described in admin now updates its Stripe Product in place instead of keeping the name it was created with. |
| 2026-10-15 | §44: `cleanup-uploads` job added (daily): removes Media uploads under `uploads/` never saved as a Media item after a day. |
| 2026-10-16 | §44: job list completed (sync-audiences, sync-stripe and event-reminders were missing) and two jobs added: `session-reminders` (every 15 minutes; reminders for Group Coaching, private sessions, workshops, the Q&A and retreats) and `pass-reminders` (daily; a month and a week before a Coaching Pass ends). New emails `session_reminder`, `session_starting`, `pass_ending`, with optional Brevo templates `BREVO_TEMPLATE_SESSION_REMINDER`, `BREVO_TEMPLATE_SESSION_STARTING`, `BREVO_TEMPLATE_PASS_ENDING`. Migration 0017. |
| 2026-10-24 | §44: test-deploy scheduler moved from GitHub Actions (late and mostly skipped runs) to Google Apps Script (`scripts/apps-script/scheduled-jobs.gs`); workflow deleted. |
| 2026-10-23 | §44: test deploy scheduled by GitHub Actions (`.github/workflows/scheduled-jobs.yml`, same schedules as `vercel.json.test`) while Vercel is on Hobby; removed when Vercel Cron is switched on at launch. |
| 2026-10-23 | §28.1: sale status `ended`, and `past`/`unscheduled` for series without a run to start (migration 0022). §42: one `notifyPaidOrder` for webhook and reconciliation; guest and gift payers get a receipt; recovered gifts' claim links go to the recipient; applicants get `retreat_application_sent`. |
