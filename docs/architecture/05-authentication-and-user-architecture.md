# Tony Klinger — Authentication & User Architecture

**File:** `05-authentication-and-user-architecture.md`

## 1. Purpose

Define the authentication and user-identity architecture for the Tony Klinger application.

This note establishes:

- Central user identity
- Supabase Auth
- Sign-up and sign-in
- Sessions
- Password recovery
- Email verification
- Authentication callbacks
- Protected routes
- Authentication middleware/proxy
- User profiles
- User lifecycle
- Account deletion
- The distinction between authentication, authorization and entitlement

The detailed roles and permissions model belongs in Architecture Note 6.

The detailed database schema belongs in the database architecture note.

---

# 2. Central Identity

The application must use **one central customer identity** across the entire Tony Klinger platform.

A customer should not create separate accounts for:

- Public website
- Coaching
- Academy
- Courses
- Memberships
- Cohorts
- Bookings
- Account

The identity follows the customer throughout the application.

Conceptually:

```text
                    ONE USER IDENTITY
                           │
          ┌────────────────┼─────────────────┐
          │                │                 │
       Account          Academy           Commerce
          │                │                 │
       Profile          Courses           Orders
       Settings         Cohorts           Payments
       Billing          Coaching          Memberships
       Bookings         Resources         Entitlements
```

The user's identity should be represented by a stable unique user identifier.

---

# 3. Supabase Auth

Use **Supabase Auth** as the authentication provider.

Supabase Auth is responsible for authentication concerns such as:

- User identity
- Sign-up
- Sign-in
- Sign-out
- Sessions
- Password management
- Email verification
- Authentication tokens
- Authentication recovery flows

The application should not implement its own password-storage system.

Passwords must never be stored directly in the Tony Klinger application's own tables.

---

# 4. Authentication vs Authorization vs Entitlement

These three concepts must remain separate.

```text
AUTHENTICATION
"Who are you?"

AUTHORIZATION
"What are you allowed to do?"

ENTITLEMENT
"What products/services/content do you have access to?"
```

Example:

```text
User is authenticated
        ↓
User identity is known
        ↓
Check authorization
        ↓
Check entitlement
        ↓
Allow requested operation/access
```

Being signed in does not automatically mean:

- The user is an Admin
- The user can access every Academy course
- The user can book every service
- The user owns every membership benefit

---

# 5. User Lifecycle

The normal user lifecycle is:

```text
Visitor
   ↓
Sign Up
   ↓
Email Verification (where required)
   ↓
Authenticated User
   ↓
Profile
   ↓
Purchases / Memberships / Enrolments
   ↓
Entitlements
   ↓
Academy / Account / Bookings
```

A user may also enter the system through a purchase or other permitted workflow that subsequently requires account creation or authentication.

The implementation must ensure that the resulting identity is linked correctly to the customer's records.

---

# 6. Sign-Up

Baseline route:

```text
/auth/sign-up
```

Sign-up should collect only the information genuinely required.

Typical information may include:

- Email
- Password
- Name

Additional information should be collected only when there is a clear business requirement.

Do not make customers complete a long profile before they can access the application unless required.

---

# 7. Sign-In

Baseline route:

```text
/auth/sign-in
```

## 7.1 Supported Sign-In Methods

Three methods, and only three:

```text
Email + password
Magic link (passwordless email)
Google OAuth
```

No other OAuth provider is enabled. Each additional provider adds an identity to
reconcile and a further way for one person to end up with two accounts.

**Account linking is the hazard, not the sign-in.** A customer who registers with
`jane@example.com` by password and later chooses "Continue with Google" for the same
address must arrive at the *same* account. If a second identity is created instead, their
orders, entitlements and bookings are stranded on an account they can no longer reach —
and the failure is silent, because both sign-ins appear to work.

The rule: identities are linked on verified email address. A Google identity is linked to
an existing account only when Google asserts the address is verified. Where that cannot be
established, sign-in is refused rather than a duplicate account created.

Magic link and OAuth both complete through `/auth/callback` (§11).

---

# 7.2 Sign-In Process

The sign-in process should:

1. Accept the customer's credentials.
2. Authenticate through Supabase Auth.
3. Establish the authenticated session.
4. Redirect the customer to an appropriate destination.

The destination may depend on context.

Examples:

```text
Customer signs in normally
→ /account

Customer signs in to access Academy
→ /academy

Customer was attempting to access protected content
→ Return to intended destination
```

Do not automatically send every authenticated user to the same page regardless of context.

---

# 7.3 The Welcome Moment

Of the three sign-in methods in §7.1, **only email + password sends an email of its
own.** A person who joins with Google or a magic link has their account created and is
signed straight in — nothing is sent, and nothing marks the occasion. Left as is, two of
the three routes in acknowledge a new customer with silence.

The welcome is therefore keyed to **first successful sign-in**, not to sign-up:

```text
password + confirmation  ──┐
magic link               ──┼──►  first successful sign-in  ──►  /welcome  +  welcome email
Google OAuth             ──┘
```

First sign-in is the one point every route passes through, whichever way the account was
made, and it is the first moment the person is provably present rather than merely
registered.

**It must happen once.** The record is `profiles.welcomed_at`, and the claim is made by
`claim_welcome()`, which sets the timestamp and reports whether it was the caller that set
it. The check and the write are a single statement, so two simultaneous sign-ins — a magic
link opened twice, a double-submitted form — cannot both see an unwelcomed profile. The
email is queued only by the caller that wins, which makes the send at-most-once before the
outbox's own idempotency key (note 09 §56) is considered.

Password **recovery** also completes through `/auth/callback` (§11), and someone resetting
a forgotten password is not a new arrival. That path is excluded explicitly.

The welcome is not a gate. It is shown once, it can be reloaded or revisited harmlessly,
and it hands the person on to wherever they were originally going — somebody who signed in
on their way to buy something is returned to that destination, not stranded.

---

# 8. Sign-Out

Sign-out should invalidate the authenticated session using Supabase Auth.

The application should provide a clear sign-out option through the authenticated user/account menu.

After sign-out:

- Protected pages must no longer be accessible as the authenticated user.
- Sensitive cached client state should not remain available to another user on the same browser session.
- The user should be returned to an appropriate public/authentication destination.

---

# 9. Password Recovery

Baseline route:

```text
/auth/forgot-password
```

The customer should be able to request password recovery through Supabase Auth.

A recovery flow should lead to an appropriate password-reset experience, for example:

```text
/auth/reset-password
```

The reset process must use Supabase's secure recovery mechanism.

Do not implement a custom password-reset-token system unnecessarily.

---

# 10. Email Verification

**Email confirmation is required in every environment, local included.**

A confirmed address is not a formality here. Guest checkout links a paid order to an
account by emailing a claim token (§29.3), so email ownership is the evidence the whole
claim flow rests on. An unconfirmed address undermines it.

Running confirmations locally as well as in production means the flow is exercised
continuously rather than first meeting reality at launch. Locally the mail is caught by
Mailpit and never leaves the machine.

Where email verification is enabled, the application should provide an appropriate verification flow.

Possible route:

```text
/auth/verify
```

The exact callback/verification mechanism should follow the current recommended Supabase Auth implementation at the time of development.

The application should not assume that an unverified email address is equivalent to a verified identity when verification is required for a particular operation.

---

# 11. Authentication Callback

Supabase authentication flows may require a server-side callback route to exchange or establish authentication state.

The exact callback route should follow the current recommended Supabase + Next.js implementation.

A typical architecture may use:

```text
/auth/callback
```

This route should:

- Receive the authentication callback
- Complete the required session exchange
- Establish the authenticated session
- Redirect to the appropriate destination

Do not hard-code an implementation based on an outdated Supabase authentication pattern.

Verify the current stable Supabase Auth documentation and recommended Next.js integration before implementation.

---

## 11.2 Two shapes of email link

Only one of them can be read by a server, and the difference is not cosmetic.

```text
?code=…         PKCE. Exchanged for a session. Used wherever the browser that
                started the flow is the one that finishes it.
?token_hash=…   A one-time token verified server-side. Used by mail sent on
                somebody else's behalf — an invitation has no browser that
                started it, so there is no PKCE verifier to pair with.
#access_token=… GoTrue's default. NOT SUPPORTED, and cannot be: a fragment is
                never sent to the server, so a Route Handler cannot see it.
```

`/auth/callback` handles the first two. Any email template that returns the third produces
a link that looks fine, arrives with nothing the server can use, and is reported to the
person as a broken link — which is what an invitation did until its template was pointed at
`{{ .TokenHash }}` (note 06 §14.2).

The token type arrives in the link and is therefore untrusted: it is checked against the
kinds of email this application actually sends before being passed to the Auth server.

---

# 11.1 Multi-Factor Authentication

MFA uses **WebAuthn only**. TOTP authenticator apps and SMS factors are both disabled.

```text
Staff (owner, admin, any operational role)
→ MFA required

Customers
→ MFA optional to HAVE, not optional to USE
```

The customer line is a clarification of "available, never required", not a reversal of it.
Nobody is ever made to register a key. What changed is what happens once they have: a
customer who set one up is challenged for it at sign-in like anybody else. The previous
reading — available, and then never asked for — made a customer's second factor
decorative, which is worse than not offering one, because it looks like protection and is
not.

WebAuthn rather than TOTP is a deliberate narrowing. A TOTP code can be read aloud,
screenshotted or typed into a convincing replica of this site; a WebAuthn credential is
bound to the origin by the browser and cannot be replayed against an attacker's page. For
the accounts that can grant entitlements, that difference is the point.

SMS is excluded for the same reason, plus SIM-swap exposure.

## Assurance levels

Supabase expresses MFA state as an assurance level carried in the session token:

```text
aal1   authenticated, no second factor presented
aal2   authenticated, WebAuthn factor verified
```

**Enforcement is server-side and database-side, never in the interface.** A staff session
at `aal1` must be refused by the Server Action, the Route Handler and the RLS policy
alike — see note 06 §20.1. Gating only the UI would leave a stolen `aal1` session able to
call the same operations directly.

## Presenting a factor

**The challenge belongs to signing in, not to the page you were heading for.** It is raised
by the sign-in action itself, and by `/auth/callback` for the magic-link and Google routes,
so the second step follows the first whichever the first one was. Before this it was raised
by whichever page happened to gate — which meant a staff member met it on reaching Admin,
and a customer met it never.

It is enforced by `requireUser()`, which every protected page already calls, so a page is
gated by existing rather than by remembering to ask. Two pages deliberately use
`requireSession()` instead and stay reachable at `aal1`:

```text
/auth/2fa               the challenge itself — gating it would be a closed loop
/account/security/mfa   enrolment, which is the only route to aal2 for an
                        account that has no keys at all
```

Everything else under `/account`, `/academy` and `/admin` requires the factor.


Enrolment and verification are **different jobs on different pages**, and conflating them
is what made staff sign-in feel broken.

```text
/auth/2fa                    challenge — present a key you already hold
/account/security/mfa        manage — register a key, add a spare, review
```

A staff session at `aal1` whose account already holds a verified factor is sent to
`/auth/2fa`. The page lives under `/auth` so it inherits the minimal authentication chrome
(note 04 §17): no site navigation, nothing to wander into part-way through signing in. The
key prompt fires **on arrival**, without the operator pressing anything, because a second
factor is a step in signing in rather than a setting to go and configure.

The automatic prompt is an accelerator and never the only route. A visible button remains,
because some browsers require a user gesture for `navigator.credentials.get()`, because a
dismissed prompt must be repeatable, and because the key may not be to hand at that
instant. A flow that depends on the automatic attempt is a flow that strands people.

**Every registered key is offered by name.** A challenge is issued against one factor, so a
staff account holding the required spare would otherwise be stuck whenever the first key
listed is the one left at home.

Only a session with **no** factor at all is sent to `/account/security/mfa`, where there is
genuinely something to set up. Sending both cases to the settings page — which is what
happened before — presented an ordinary sign-in as a configuration error and, because
enrolment also verifies, taught operators to register a redundant new key on every sign-in.

The challenge exists in exactly one implementation. The settings page links to it rather
than carrying its own copy.

## Enrolment and recovery

**One verified factor admits a staff member. A second is required only of the owner.**

The distinction is who can rescue whom:

```text
admin loses their only key   -> an owner clears it. A support task.
owner loses their only key   -> nobody can help. aal2 is required by the RLS
                                policies themselves, so recovery means
                                service-role SQL against production.
```

The spare key exists to prevent lockout. Refusing an operator entry until they hold one
would therefore penalise them at exactly the moment it is meant to protect them — so staff
are **prompted** for a second key, not blocked by it.

The owner account is the exception, because it is the one that cannot be recovered from
inside the application. It must hold two verified keys before performing any privileged
action. This is enforced in `requirePermission()` and again in `assert_admin_action()`, so
a call that bypasses the application still meets it.

A staff member without any verified factor can sign in but can reach nothing privileged;
the flow directs them to enrolment rather than showing an unexplained refusal.

Losing an authenticator must not become an account takeover route. Recovery is an
administrative operation performed by another authorized person, audited under note 06
§31 — never a self-service email link, which would reduce MFA to the strength of the inbox
it protects.

That operation is `/admin/users/[id]` → **Clear security keys**, and the rule about who may
clear whose keys lives in the database (`admin_record_mfa_reset`, migration 0036) rather
than only in the interface:

```text
a customer's keys      anyone holding users.reset_mfa
a staff member's keys  an OWNER only — those keys guard the admin area, so
                       clearing them is an access decision, not support work
an owner's keys        REFUSED. Nobody can rescue an owner from inside the
                       application, which is also what stops this being an
                       escalation path
your own keys          REFUSED, or the requirement is optional for anyone who
                       holds the permission
```

The control matters more now than it did. While only staff were challenged, a customer
could never be locked out by a second factor; now that anyone who registers a key is asked
for it, a customer who loses their only key cannot reach their account until somebody
performs this. The challenge page says so plainly rather than linking them to a settings
page where nothing can be done — Supabase refuses to enrol a replacement factor from an
unverified session, so that page is a dead end at exactly the wrong moment.

## Break-glass

Because `aal2` is required in RLS policies and not only in application code, a total staff
lockout cannot be resolved through the application. That is the property that makes the
control meaningful, and it has a consequence that must be planned rather than discovered:

```text
Two owner accounts, each with two enrolled factors
        ↓  if all are lost
Direct SQL via the service role clears the factors
        ↓
Re-enrolment, and an audit record written after the fact
```

The break-glass path is deliberate, documented and rare. It exists because the alternative
— a convenient in-app reset — would be exactly the bypass an attacker would use.

---

# 12. Session Management

Authenticated sessions must be handled securely.

The application should use the current recommended Supabase session/cookie architecture for Next.js.

Server-side code must be able to determine the authenticated user.

The application should not trust a user ID supplied by the browser when determining who the current authenticated user is.

Instead:

```text
Authenticated server session
        ↓
Trusted user identity
        ↓
Database query / authorization check
```

---

# 13. Authentication in Server Components

Server Components may retrieve the authenticated user/session using the server-side Supabase client.

Example conceptual flow:

```text
Server Component
      ↓
Supabase server client
      ↓
Authenticated session
      ↓
Current user
      ↓
Data query
      ↓
Render UI
```

Server Components should be preferred for server-rendered authenticated page data where appropriate.

Do not turn a page into a Client Component simply because it needs to know the current user.

---

# 14. Authentication in Client Components

Client Components may need authenticated-user information for interactive behaviour.

Examples include:

- User menus
- Client-side state
- Interactive account controls
- Real-time UI updates

Client-side authentication state must not be treated as the sole security mechanism.

The server and database must independently enforce access.

---

# 15. Authentication Middleware / Proxy

The application should use the current supported Next.js mechanism for handling authentication/session refresh and route protection.

As implemented on Next.js 16.3.3 this is `src/proxy.ts` — the renamed `middleware`
convention. See note 02 §21.1.

The implementation must follow the current stable Next.js and Supabase recommendations rather than blindly using an outdated middleware pattern.

Its responsibilities may include:

- Refreshing authentication state where required
- Protecting appropriate route areas
- Redirecting unauthenticated users
- Preserving intended destinations

However, route protection at this layer is not a replacement for server-side authorization or Supabase RLS.

---

# 16. Protected Route Areas

The major protected areas are:

```text
/academy/...   (below the landing page)
/account/...
```

`/academy` itself is the exception. The landing page is public: it explains what the
Academy is and provides the sign-in entry point, per note 01 §8 and note 03 §18. Every
route beneath it requires a session.

Admin requires additional authorization:

```text
/admin/...
```

Authentication alone is sufficient to establish identity but not sufficient to grant all access.

Conceptually:

```text
/academy
→ public Academy landing / sign-in entry point

/academy/courses
→ authenticated user required

/admin
→ authenticated user + Admin authorization required

/academy/courses/example
→ authenticated user + appropriate entitlement required
```

---

# 17. Public Routes

Most public content remains accessible without authentication.

Examples:

```text
/
/about
/blog
/catalogue
/coaching
/events
/contact
```

Public product pages should normally be accessible to guests.

A guest should be able to understand an offering before being asked to sign in.

---

# 18. Account Protection

All customer Account pages should require authentication.

For example:

```text
/account
/account/profile
/account/orders
/account/memberships
/account/bookings
/account/billing
/account/security
/account/settings
```

A user must only be able to access their own account information.

This must be enforced server-side and through database security.

---

# 19. Academy Protection

Academy pages require authentication.

However:

```text
Authenticated
≠
Entitled to everything
```

A customer may be authenticated but have no purchased Academy content.

Therefore Academy access should follow:

```text
Authenticated User
        ↓
Determine Entitlements
        ↓
Determine Permitted Content
        ↓
Allow / Deny Access
```

---

# 20. Admin Protection

Admin pages require both:

```text
Authenticated User
        +
Appropriate Admin Authorization
```

Do not rely solely on:

- Hidden menu items
- Client-side role checks
- URL obscurity

Admin authorization must be enforced on the server and supported by database-level security where appropriate.

The detailed Admin roles and permission matrix will be defined in Architecture Note 6.

---

# 21. User Profile

Supabase Auth owns the authentication identity.

Application-specific profile information should be stored separately from the authentication system where appropriate.

Conceptually:

```text
Supabase Auth User
        │
        │ user_id
        │
Application Profile
```

A profile may contain information such as:

- Display name
- First name
- Last name
- Avatar
- Contact preferences
- Application-specific settings

Do not duplicate authentication credentials into the profile table.

---

# 22. User ID as the Primary Link

Application records should reference the authenticated user's stable ID.

Examples:

```text
orders.user_id
bookings.user_id
profiles.user_id
memberships.user_id
entitlements.user_id
```

This creates a consistent identity relationship across the application.

Avoid using email addresses as the primary relational identity between records.

Email addresses can change; the authenticated user ID should remain the stable application identity.

---

# 23. User Profile Creation

When a new authenticated user is created, the application should establish the corresponding application profile where required.

The exact mechanism may be:

- Application-side creation
- Database trigger
- Another reliable server-side process

The chosen mechanism must prevent inconsistent states where an Auth user exists indefinitely without the required application profile.

The final implementation should be idempotent where possible.

---

# 24. Account Deletion

Account deletion must be treated as a controlled lifecycle operation.

A user deletion may affect related records such as:

- Profile
- Orders
- Membership records
- Entitlements
- Bookings
- Course enrolments
- Notifications
- Email-related records
- Other customer-specific data

The application must not simply delete the Auth user and assume the rest of the system is automatically correct.

Deletion behaviour should be deliberately defined according to the legal, financial and operational requirements of each record.

---

# 25. Financial Records and Deletion

Financial records may require retention even after a customer account is deleted.

Therefore the architecture must distinguish between:

```text
Customer personally identifiable information
```

and:

```text
Financial/accounting records that may require retention
```

Do not blindly cascade-delete every historical order/payment record.

The final retention/deletion policy must be implemented deliberately.

Where appropriate, personal information can be anonymized while retaining required financial records.

---

# 26. User Deletion Cleanup

Deletion may require coordinated cleanup across:

```text
Auth
 │
Profile
 │
Customer data
 │
Entitlements
 │
Bookings
 │
Notifications
 │
Email systems
```

Some cleanup may belong to PostgreSQL/Supabase through:

- Foreign-key constraints
- Cascades
- Triggers

Other cleanup may require server-side processing or external-service operations.

Do not put all deletion logic inside a React component or client-side hook.

---

# 27. Email-System Cleanup

When a customer is deleted or requests appropriate removal, the application may need to synchronize their state with Brevo.

Examples:

```text
User deletion
      ↓
Application deletion/anonymization
      ↓
Remove or update Brevo contact
```

This must be implemented through a trusted server-side integration.

Do not expose Brevo API credentials to the browser.

---

# 28. Authentication Events vs Business Events

Authentication events and business events must remain distinct.

For example:

```text
User signs up
→ Authentication event

Customer purchases Gold
→ Commerce/business event

Customer receives Gold entitlements
→ Entitlement event

Customer books a coaching session
→ Booking event
```

A user being authenticated should not automatically create commercial entitlements.

---

# 29. Authentication and Purchases

The application supports **both guest checkout and signed-in checkout**. A customer is not
required to hold an account before paying.

```text
Signed-in checkout
→ order.user_id set at creation from the trusted server session

Guest checkout
→ order has no user_id; it carries the purchase email and is claimable
```

The system must ensure that the final order is linked to the correct authenticated customer.

A trusted server-side identity should be used when associating a purchase with a user.

Do not trust arbitrary `user_id` values submitted by a browser.

## 29.1 Signed-in Checkout

When the customer already has a session, the order's `user_id` is taken from the server
session at the moment the order is created — never from a form field, a query parameter or
any other browser-supplied value. Entitlements attach to that user as normal.

## 29.2 Guest Checkout

A guest completes payment having supplied only an email address. The resulting order is
created with no `user_id` and is marked as unclaimed. Payment, order and entitlement
records are all created by the Stripe webhook exactly as they are for a signed-in customer
— guest checkout changes who the records point at, not whether they exist.

An unclaimed order is a real order. It is not provisional and must not expire or be cleaned
up as though it were an abandoned cart.

## 29.3 Claiming a Guest Purchase

Entitlements require a user identity (§22), so a guest purchase must be linked to an account
before its access can be delivered.

The claim process is:

```text
Guest purchase completed
        ↓
Claim token generated — single-use, expiring, server-side
        ↓
Claim link emailed to the address that paid
        ↓
Recipient signs in, or creates an account
        ↓
Server verifies: valid token + authenticated session
        ↓
Order and its entitlements linked to that user_id
        ↓
Token invalidated
```

The rules that make this safe:

- **The email address is proof of nothing on its own.** Possession of the emailed claim
  token, combined with an authenticated session, is what authorizes the link. An order must
  never be claimable by submitting an order ID, an email address, or both.
- **The token is single-use, expiring and server-generated.** It is stored server-side,
  invalidated on use, and never derived from guessable values such as the order ID or an
  incrementing number.
- **Claiming requires an authenticated session.** The claim endpoint links the order to
  `auth.uid()`, not to a user identifier supplied in the request.
- **An existing account is not linked silently.** If the purchase email already belongs to
  an account, the claim link still requires the recipient to sign in to that account before
  the order is attached. The application must not attach a purchase to an existing account
  merely because the email matched, since the payer and the account holder are not
  necessarily the same person.
- **The operation is idempotent.** Replaying a claim must not duplicate entitlements, and a
  second attempt with a spent token must fail cleanly rather than error.
- **The claim is a server-side operation** behind the trusted boundary described in §32.
- **There must be a supported recovery path when the claim email is unreachable.** A guest
  who mistypes their email has still paid, and the emailed token can never reach them. Per
  note 09 §6 and note 08 §42, a controlled, support-mediated process must exist for
  establishing ownership by other trusted evidence. It is a manual, audited operation — not
  a self-service endpoint — and it must not become a way to claim an order by quoting an
  order ID or an email address.

An order that is never claimed remains in the system as a paid, unclaimed order. It is a
customer-service and reconciliation concern, not a record to be deleted. Note 08 §58
enforces this at the data-lifecycle level: background cleanup may remove abandoned checkout
sessions that never resulted in payment, and never removes an order that did.

## 29.4 Checkout and Identity

Checkout must therefore work without a session, and `/checkout` and `/checkout/success`
must both render correctly for a guest. Note 03 §28 defines the routes; this section defines
what identity means within them.

---

# 30. Authentication and Memberships

Membership records must reference the application's user identity.

Membership access should be determined by:

- Current membership status
- Membership plan
- Subscription state
- Entitlements
- Relevant dates

Do not determine membership merely from the user's authentication state.

For example:

```text
Authenticated user
≠
Active Gold member
```

---

# 31. Authentication and Bookings

Bookings must be associated with the authenticated user.

Before creating or modifying a booking, the server should verify:

```text
Current authenticated user
        ↓
Eligible service/entitlement
        ↓
Booking availability
        ↓
Booking belongs to current user
```

A customer must not be able to manipulate another customer's booking by changing an ID in a request.

---

# 32. Security Boundaries

The architecture should follow:

```text
Browser
   ↓
Next.js server boundary
   ↓
Supabase / trusted backend
   ↓
Database
```

Sensitive operations should cross a trusted server boundary before privileged processing.

Examples include:

- Admin operations
- Payment processing
- Entitlement creation
- Membership changes
- Sensitive account changes
- External API calls using secrets

---

# 33. Row Level Security

Supabase Row Level Security (RLS) is part of the database security model.

Where appropriate, customer-owned records should be protected by policies based on the authenticated Supabase user identity.

Conceptually:

```text
auth.uid()
    ↓
Current authenticated user
    ↓
RLS policy
    ↓
Only permitted rows
```

RLS must complement application-level authorization rather than being treated as a replacement for good application architecture.

---

# 34. Service-Role Security

The Supabase service-role key bypasses normal RLS protections and is therefore highly privileged.

It must:

- Remain server-side
- Never be exposed to browser code
- Never be committed to GitHub
- Be used only where genuinely required

Most normal customer operations should use the authenticated user's server/client Supabase context rather than a service-role client.

---

# 35. Authentication Error Handling

Authentication failures should provide clear user-facing messages without revealing unnecessary security-sensitive information.

Examples:

- Invalid credentials
- Expired recovery link
- Verification required
- Session expired
- Authentication service temporarily unavailable

Do not expose internal Supabase/database errors directly to customers.

---

# 36. Redirect Security

Authentication redirects must be validated.

Do not blindly redirect a user to an arbitrary URL supplied through a query parameter.

Use approved internal destinations or a validated allowlist.

This applies particularly to:

```text
/auth/sign-in?next=...
```

and authentication callback flows.

**The allowlist is a list, not a blanket rule.** Validation rejects anything that is not a
root-relative path, and additionally rejects the `/auth/` area, because returning someone
to a sign-in page after signing in loops. But two destinations inside `/auth/` are
legitimate ends rather than entry points, and a blanket rejection breaks them:

```text
/auth/reset-password    the form the recovery email exists to reach
```

Password recovery sends a link whose whole purpose is to arrive at that form. A rule that
refuses every `/auth/` path silently redirects the customer to their account instead,
having already consumed the one-time recovery code — so the reset can never be completed
and the link cannot be reused. Named destinations are therefore permitted explicitly, and
everything else under `/auth/` stays refused.

---

# 37. Session Expiration

The application must handle expired or invalid sessions gracefully.

If a protected page is requested without a valid session:

```text
Protected route
      ↓
No valid authentication
      ↓
Redirect to sign-in
      ↓
Return to intended destination where safe
```

The customer should not be unnecessarily sent to the Home page when a safe return destination is available.

## 37.1 The other direction: no destination was ever intended

**2026-09-05.** §37 says what happens when the proxy forced the visit to `/auth/sign-in` —
return to the page that was actually asked for, via `next`. It does not say what happens
when nothing forced it: someone who opens sign-in of their own accord, with no protected
page behind the request. `DEFAULT_REDIRECT` (`src/lib/auth/safe-redirect.ts`) was `/account`
unconditionally, so both cases looked identical in the code and produced the same result —
every sign-in with no `next` landed on the account page, whether or not one was ever wanted.

The two cases are meant to differ. The proxy only ever sets `next` when it is the one
redirecting an unauthenticated request (`signInUrl()` in `src/proxy.ts`); a self-initiated
visit carries none. `DEFAULT_REDIRECT` is now `/` — home — so a customer who chose to sign in
lands back on the site rather than being pushed straight into their account, while a customer
who was stopped at a protected page is still returned to it exactly as §37 requires, unaffected
by this change since `next` takes priority whenever it is present. Applies uniformly wherever
`DEFAULT_REDIRECT`/`safeRedirect`'s fallback is used: password sign-in, magic link, Google
OAuth, `/auth/callback`, the post-2FA return, and password-reset completion.

---

# 38. Authentication UX

Authentication should feel like part of the same Tony Klinger platform.

The UI should support:

- Clear sign-in
- Clear sign-up
- Password recovery
- Verification
- Useful error messages
- Appropriate loading states
- Mobile usability
- Accessible forms

Authentication pages should use the minimal task-focused layout defined in Architecture Note 4.

---

# 39. Current Technology Requirement

Use the latest stable, production-safe versions of:

- Next.js
- React
- Supabase
- Supabase Auth libraries
- TypeScript
- Other project dependencies

Before implementation, verify the current recommended Supabase + Next.js authentication architecture.

Do not copy an old authentication implementation from an outdated tutorial.

In particular, verify current guidance for:

- Supabase SSR
- Authentication cookies
- Session refresh
- Next.js middleware/proxy conventions
- Auth callbacks
- Server Components
- Server Actions

---

# 40. Authentication Architecture Summary

The complete identity model is:

```text
                    VISITOR
                       │
                       ↓
                    SIGN UP
                       │
                       ↓
               SUPABASE AUTH
                       │
                       ↓
              AUTHENTICATED USER
                       │
              ┌────────┼────────┐
              │        │        │
              │        │        │
           PROFILE   ACCOUNT   AUTHORIZATION
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                 CUSTOMER      ADMIN       OTHER ROLE
                    │
                    ↓
               ENTITLEMENTS
                    │
          ┌──────────┼──────────┐
          │          │          │
       COURSES   MEMBERSHIP  BOOKINGS
```

The essential distinctions are:

```text
Authentication
→ Who the user is

Authorization
→ What the user is allowed to do

Entitlement
→ What the user has purchased/been granted access to
```

These must remain separate throughout the application.

---

# 41. Architectural Principle

The authentication architecture should provide:

**One identity, one account, secure sessions, server-enforced authorization, database-enforced ownership, and entitlement-based access.**

Authentication should be centralized through Supabase Auth while business identity and customer data remain properly represented in the application's database.

The architecture must be secure by design and must not rely on client-side checks, hidden navigation or obscured URLs as security mechanisms.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1). Box-drawing characters, arrows and symbols restored to `├── └── │ ┌ ┼ ─ ↓ → ≠ —`; the `≠` in §19 and §30, and the `→`/`↓`/`│` distinctions throughout, reconstructed from context. Column alignment in the §2 and §40 diagrams was normalized where the mis-decoding had destroyed it. No wording was altered. |
| 2026-08-28 | §16: `/academy` recorded as a public Academy landing / sign-in entry point, with the protected area beginning below it — reconciling this note with note 01 §8. Closes R14. |
| 2026-08-28 | §29: expanded to support both guest and signed-in checkout, with §29.1–§29.4 defining the secure claim process for linking a guest purchase to an account. Closes R12. Numbered as subsections so that no existing section number changes. |
| 2026-08-28 | §29.3: cross-referenced note 08 §58, which enforces at the data-lifecycle level that paid unclaimed orders are never removed by background cleanup. Supports R20. |
| 2026-08-28 | §29.3: added the required recovery path for a paid guest who cannot receive the claim email — a controlled, support-mediated and audited process, per note 09 §6 and note 08 §42. Without it the claim rules as written left a paying customer with no route to their purchase. |
| 2026-08-28 | §15: recorded that the current Next.js mechanism is `src/proxy.ts` as of Next.js 16.3.3, cross-referencing note 02 §21.1. |
| 2026-08-29 | §7.1 (new), §7.2: sign-in methods fixed at email+password, magic link and Google OAuth, with the account-linking rule recorded — identities link on verified email, and a duplicate account is never created silently. |
| 2026-08-29 | §10: email confirmation made mandatory in every environment including local, because the guest-order claim flow (§29.3) rests on email ownership. |
| 2026-08-29 | §11.1 (new): MFA defined as WebAuthn only — mandatory for staff, optional for customers — enforced through Supabase assurance levels (aal1/aal2) server-side and in RLS, with administrative, audited recovery rather than a self-service email reset. |
| 2026-08-30 | §11.1: staff must enrol **two** WebAuthn factors so a lost device is an inconvenience rather than an account recovery; break-glass recorded — two owner accounts, and service-role SQL as the documented last resort, since `aal2` in RLS means a total lockout cannot be resolved in-app. |
| 2026-08-30 | §7.1: verified-email linking now enforced in `/auth/callback` — a provider identity whose address is unverified is refused and the session ended, rather than linked to an existing account. |
| 2026-08-31 | §11.1 corrected. The note previously required two factors of all staff, but the implementation gated only on `aal2` — so the stated rule was never enforced and read as a guarantee it did not provide. Now: one verified key admits any staff member, a second is prompted, and two are **required of the owner** before privileged actions, since an owner lockout cannot be resolved in-app. Enforced in `requirePermission()` and in `assert_admin_action()` (migration 0014). |
| 2026-09-02 | §7.3 (new): the welcome moment defined — keyed to first successful sign-in rather than sign-up, because only one of the three methods in §7.1 sends any email of its own. Recorded once in `profiles.welcomed_at` and claimed atomically by `claim_welcome()` (migration 0017), with password recovery explicitly excluded. |
| 2026-09-02 | §36 amended. **Implementation finding:** the blanket refusal of `/auth/` destinations broke password recovery — the emailed link exchanged its one-time code and then redirected to `/account`, so the reset form was never reached and the link could not be reused. Named destinations inside `/auth/` are now permitted explicitly; everything else there stays refused. |
| 2026-09-05 | §11.2 (new), §36: `/auth/callback` extended to verify `token_hash` links server-side, and the fragment form recorded as unsupportable rather than merely unsupported. `safeRedirect` now matches its allowed `/auth/` destinations on the PATH, so `/auth/reset-password?invited=1` survives; `/auth/2fa` added to that set, being a step that finishes authentication rather than starting it. |
| 2026-09-05 | §11.1: `/auth/2fa` recorded as the challenge step, distinct from enrolment at `/account/security/mfa`. A staff session holding a key is now challenged immediately, in the auth chrome, rather than being sent to the settings page to find a button; only a key-less account is sent to enrolment. Every registered key is offered by name, since a challenge is bound to a single factor. |
| 2026-09-05 | §11.1: the second factor moved into the SIGN-IN step and extended to customers who have set one up. The customer rule is clarified — MFA is optional to have, not optional to use — because a key that is never asked for is decorative. Enforcement moved into `requireUser()`, with `/auth/2fa` and `/account/security/mfa` deliberately using `requireSession()` so neither becomes a closed loop. MFA state is now derived from the `getUser()` call each request already makes rather than from two further round trips, which is what had made computing it for customers look expensive. Recovery recorded with the rule now in the database (migration 0036): a customer's keys may be cleared by anyone holding `users.reset_mfa`, a staff member's only by an owner, an owner's not at all, and never one's own. |
