# Tony Klinger — Roles & Admin Architecture

**File:** `06-roles-and-admin-architecture.md`

## 1. Purpose

Define the authorization and administrative architecture for the Tony Klinger application.

This note establishes:

- Who can access `/admin`
- Administrative roles
- Permissions
- Ownership boundaries
- Admin navigation visibility
- Server-side authorization
- Database-level enforcement
- Separation between customer access and administrative access

Authentication is defined in Architecture Note 5.

Authentication answers:

```text
Who is this user?
```

This note answers:

```text
What is this user allowed to do?
```

Entitlements answer:

```text
What products/services/content does this customer have access to?
```

These concerns must remain separate.

---

# 2. Core Authorization Principle

Authorization must be enforced server-side.

The application must never rely on:

- Hidden menu items
- Hidden buttons
- Client-side role checks
- Obscured URLs
- Browser state
- User-supplied role information

as the actual security boundary.

The basic model is:

```text
Authenticated User
        ↓
Determine Role / Permissions
        ↓
Authorize Operation
        ↓
Allow / Deny
```

Database-level security should provide an additional protection layer.

---

# 3. Administrative Access

The `/admin` area is restricted to users with an appropriate administrative role.

Conceptually:

```text
User
 │
 ├── Customer
 │      │
 │   No Admin access
 │
 └── Administrator
        │
     /admin
```

Being a customer, paid member or course participant does not automatically grant administrative access.

---

# 4. Owner Role

The system should support an owner-level administrative role.

The role should represent the **business owner**, not a person's name.

Use a role such as:

```text
owner
```

rather than:

```text
tony
```

The owner role should have the highest application-level administrative privileges.

The owner should be able to manage the full administrative system subject to any unavoidable platform/security restrictions.

---

# 5. Administrator Role

Support a general administrative role:

```text
admin
```

An administrator can be granted broad operational access without necessarily having every owner-level capability.

The exact distinction between `owner` and `admin` should be explicit in the permission model.

Do not assume every employee or contractor needs full administrative access.

---

# 6. Operational Staff Roles

The system should support more granular operational roles where appropriate.

Potential roles include:

```text
content_manager
course_manager
coaching_manager
booking_manager
finance_manager
communications_manager
support_manager
```

These are examples of possible roles rather than a requirement that all of them must exist on day one.

The architecture should allow additional roles to be added without redesigning the authorization system.

---

# 7. Role-Based Access Control

Use a role/permission model rather than scattering role names throughout application code.

Conceptually:

```text
User
 ↓
Role
 ↓
Permissions
 ↓
Resource / Action
```

For example:

```text
course_manager
      ↓
courses.read
courses.create
courses.update
courses.publish
```

This is preferable to writing many unrelated checks such as:

```text
if user.role === "course_manager"
```

throughout the application.

Where simple role checks are sufficient, they may still be used through centralized authorization helpers.

---

# 8. Permissions

Permissions should represent actions rather than merely screens.

Examples:

```text
users.read
users.update
users.delete

products.read
products.create
products.update
products.delete

courses.read
courses.create
courses.update
courses.publish

memberships.read
memberships.update

entitlements.read
entitlements.grant
entitlements.adjust
entitlements.revoke

orders.read
payments.read

bookings.read
bookings.create
bookings.update
bookings.cancel

events.read
events.create
events.update
events.delete

blog.read
blog.create
blog.update
blog.publish
blog.delete

catalogue.read
catalogue.create
catalogue.update
catalogue.publish
catalogue.delete

masterclasses.read
masterclasses.create
masterclasses.update
masterclasses.publish

emails.read
emails.send
```

The final permission matrix should be based on actual operational requirements.

Do not create hundreds of permissions without a genuine need.

---

# 9. Resource-Level Authorization

Authorization should consider both:

```text
What action?
```

and:

```text
Which resource?
```

For example:

```text
courses.update
```

does not necessarily mean every staff member can update every course.

A role may be restricted to:

- Certain content types
- Certain business areas
- Certain records
- Certain operations

Where resource-level restrictions are unnecessary, keep the model simpler.

---

# 10. Admin Permission Matrix

The eventual Admin system should maintain a clear permission matrix.

Example:

| Area | Owner | Admin | Specialist |
|---|---:|---:|---:|
| Users | Full | Configured | Limited |
| Roles | Full | Limited | None |
| Products | Full | Full | Limited |
| Memberships | Full | Full | Limited |
| Entitlements | Full | Configured | None |
| Courses | Full | Full | Course |
| Masterclasses | Full | Full | Course |
| Blog | Full | Full | Content |
| Catalogue | Full | Full | Content |
| Group Coaching | Full | Full | Coaching |
| Cohorts | Full | Full | Coaching |
| Private Coaching | Full | Full | Coaching |
| Retreats | Full | Full | Relevant |
| Events | Full | Full | Relevant |
| Bookings | Full | Full | Booking |
| Orders | Full | Full | Finance |
| Payments | Full | Full | Finance |
| Emails | Full | Full | Communications |
| Settings | Full | Limited | None |

This is a baseline model.

The final permission assignments should be confirmed against actual business responsibilities before implementation.

---

# 11. Customer vs Staff

The application must distinguish normal customers from operational users.

A customer may have:

```text
customer
```

while an internal user may have:

```text
owner
admin
specialist role
```

A customer's purchases or memberships must never automatically grant administrative permissions.

For example:

```text
Ultimate Membership
        ≠
Admin access
```

---

# 12. Multiple Roles

The architecture should allow a user to have more than one role if required.

For example:

```text
User
 ├── course_manager
 └── communications_manager
```

This avoids creating unnecessary combined roles such as:

```text
course_and_communications_manager
```

when the underlying permissions can be composed.

Whether multiple roles are enabled initially can be determined during implementation, but the authorization design should not prevent it.

---

# 13. Role Assignment

Role assignment must be performed through a trusted administrative operation.

A customer must not be able to submit:

```text
role = "admin"
```

from the browser and gain access.

Role assignment should require:

- Appropriate authorization
- Server-side validation
- Database-level controls where appropriate
- Auditability

Owner-level role changes should receive particularly strong protection.

## 13.1 Where roles are read, and where they are granted

```text
/admin/roles         READ. What each role allows, and who holds it.
/admin/users/[id]    GRANT. The decision is made about a PERSON.
```

The roles page answers the two questions the model raises — what does this role permit,
and who currently has it — from `roles`, `role_permissions` and `user_roles`, so a role
introduced by a migration appears without a code change. §7 requires role names not to be
scattered through application code, and a page that hard-coded them would be the first
place that rule broke.

Granting is deliberately **not** on the roles page. You grant a role to a person, not a
person to a role, and the surrounding context for that decision — their orders,
entitlements and existing roles — is on their own page. It runs through `admin_set_role`
so it stays a trusted server-side operation with an audit entry (§13, §31).

The form is called with the **operator's own session**, never the service role:
`admin_set_role` reads `auth.uid()` for the permission check, the assurance level and the
audit entry's actor, and a service-role call would present nobody to record.

**A reason is required by the interface even though the column accepts null.** A role
change with no explanation is indistinguishable from a mistake or an abuse of privilege,
and the explanation is the entire value of the audit trail.

One caveat the interface must respect: `admin_set_role` reports an unknown role in its
RESULT rather than as an error, so a caller that only checks for an error will report
success on a silent no-op.


---

# 14. Admin User Management

Authorized administrators should eventually be able to:

- View users
- Search users
- View relevant customer information
- Manage appropriate roles
- Disable appropriate access
- Review memberships
- Review entitlements
- Review bookings
- Review orders

Sensitive operations should require appropriate permissions.

---

## 14.1 Team membership is a presentation choice, not a role

A person shown on the public team page and a person holding a staff role are two different
facts, and the schema keeps them separate. `team_members.user_id` is a **nullable, unique**
link to the account the team member is:

```text
user_id set    a user who is also shown publicly
user_id null   someone shown publicly who has no account
```

Nullable because the published biographies came from the old site and those people have no
accounts; making it required would mean inventing accounts or deleting real content.
Unique because one account must not appear on the team page twice (note 03 §37).
`ON DELETE SET NULL` because deleting an account must not silently remove a published
biography — the entry stays and stops being linked.

**Appearing on the team page grants nothing.** A team member need not be staff, and staff
need not appear on the team page (§11). The two are administered separately and neither
implies the other — which is why the control sits in its own section of the person's page,
below roles and visibly separate from them.

The control offers three actions, because three different things can be meant:

```text
create   this account has no public entry; make one
link     an entry exists and was never connected to an account
remove   unlink, WITHOUT deleting the entry
```

**Linking is never inferred.** An existing entry is connected only because an operator
picked it from a list: matching a display name against a biography's name would quietly
attach one person's orders and entitlements to another person's public identity.

**Removing unlinks rather than deletes.** A published biography is content, and losing it
because somebody's staff status changed is the accident `ON DELETE SET NULL` was chosen to
avoid.

## 14.2 Creating a user means INVITING one

An administrator could previously grant a role only to somebody who had already
signed up for themselves — and staff are exactly the people who never do that. Nobody signs
up as a customer in order to be given the support role.

```text
/admin/users   →  Invite someone  →  email  →  set your own password
```

**An invitation, not an account with a password an operator chose.** An administrator who
types somebody's first password knows their credential, and the account stops being
provably theirs — which is the property note 05 §11.1 spends its whole effort on. The
invitee proves control of the mailbox and picks their own secret, which is also the only
version of events an audit trail can honestly describe.

It carries its own permission, `users.invite` (migration 0035), held by owner and admin.
Creating an account is not editing one: it adds a principal that can then be given roles,
so folding it into `users.update` would hand it to every role that can correct a
customer's name (§33).

The order of operations is deliberate:

```text
1. permission + second factor, in the application
2. the invitation itself — a GoTrue admin call, not SQL
3. the audit entry, which re-checks both in the database
```

Step 3 can only fail if step 1 was wrong, and an account created with no record of who
created it is precisely what an audit log exists to prevent — so that case **removes the
account it just made** rather than leaving an unattributable principal in the system.
`admin_record_user_invite` is narrow by design: it takes no action name and no resource
type, so it can only ever write the one entry it is named for. A general "log anything"
function that let the caller choose the permission it checks would let anyone holding any
permission forge entries about anything.

### The invitation link must be a server-side token

GoTrue's default invite email returns the session in the URL **fragment**
(`#access_token=…`). A fragment is never sent to the server, so `/auth/callback` saw no
code and bounced every invitation to sign-in as a broken link.

The invite template therefore uses `{{ .TokenHash }}`, and the callback verifies it
server-side into a cookie session (note 05 §11). A hosted project keeps its templates in
the dashboard rather than in `config.toml`, so **that change must be mirrored on the
project** or production invitations break in exactly this way.

The link lands on the password form rather than on the account: accepting an invitation
means setting a password, and without that the new person arrives holding a session and no
credential of their own — able to use the site once, and unable to sign in again.

### Searching

The user list searches NAME columns only. An email address lives in `auth.users`, which
PostgREST does not expose and cannot be joined from here, so the page says which fields it
searches rather than silently returning nothing for the field most people would type into
first.

---

## 14.3 Handing an account back

`users.reset_mfa` (migration 0036), held by owner and admin, clears a person's security
keys so they can register again. The rule about who may do it to whom is note 05 §11.1 and
is enforced by `admin_record_mfa_reset` in the database, not only by the form: a customer's
keys may be cleared by any holder of the permission, a staff member's only by an owner, an
owner's not at all, and **never one's own** — otherwise the second factor is optional for
anyone who holds the permission.

The function is called BEFORE anything is destroyed, so a refusal arrives while there is
still something to refuse, and a reason is required as with every other privileged act
here. A partial failure is reported rather than swallowed: keys removed but not all of them
leaves the person still locked out while the audit log says they were helped.

---

---

# 15. User Deactivation

The application should distinguish between:

```text
Account deletion
```

and:

```text
Account/access deactivation
```

A user may need to be prevented from signing in without immediately deleting historical business records.

For example:

```text
Active
Suspended
Deactivated
Deleted
```

The exact lifecycle states can be defined in the implementation/schema architecture.

---

# 16. Admin Access to Customer Data

Admin access to customer information should be limited according to the administrator's permissions.

Do not expose unnecessary sensitive information to every administrator.

For example:

- A booking manager may need booking information.
- A course manager may need enrolment/progress information.
- A finance manager may need order/payment information.

Access should follow operational necessity.

---

# 17. Financial Permissions

Financial data should receive appropriate protection.

Examples:

```text
orders.read
payments.read
refunds.manage
```

Not every operational administrator needs access to financial operations.

If refunds or payment changes are supported, they should require an appropriately privileged role.

---

# 18. Content Permissions

Content-management permissions should be separated where useful.

Examples:

```text
courses.read
courses.create
courses.update
courses.publish

catalogue.read
catalogue.create
catalogue.update
catalogue.publish

blog.read
blog.create
blog.update
blog.publish
```

```text
masterclasses.read
masterclasses.create
masterclasses.update
masterclasses.publish
```

Publishing can be treated as a distinct permission from editing where the workflow requires editorial approval.

Blog and Catalogue are first-class managed content domains with their own Admin areas at
`/admin/blog` and `/admin/catalogue` (note 03 §25). Their content model, publishing states
and media relationships are defined in note 08. The `content_manager` role (§6) is the
natural holder of the `blog.*` and `catalogue.*` permissions.

Masterclasses are Academy content managed alongside courses, and are delivered through
entitlements rather than published publicly (note 07 §22).

---

# 19. Coaching Permissions

Coaching operations may require permissions such as:

```text
coaching.read
coaching.manage
sessions.read
sessions.manage
bookings.read
bookings.manage
```

A coaching manager should be able to manage relevant coaching operations without automatically receiving unrelated financial or system privileges.

---

# 20. Cohort Permissions

Cohort management may include:

```text
cohorts.read
cohorts.create
cohorts.update
cohorts.publish
cohorts.manage_participants
cohorts.manage_sessions
```

The exact permission granularity should remain proportional to the operational complexity.

---

# 21. Booking Permissions

Booking management may include:

```text
bookings.read
bookings.create
bookings.update
bookings.cancel
bookings.manage_availability
```

Booking permissions should not automatically grant access to financial data unless separately authorized.

---

# 22. Event and Retreat Permissions

Events and retreats may require:

```text
events.read
events.create
events.update
events.delete
events.manage_registrations

retreats.read
retreats.create
retreats.update
retreats.manage_applications
retreats.manage_registrations
```

Again, the final permission list should reflect actual operational needs.

---

# 23. Communications Permissions

Communications management may include:

```text
emails.read
emails.send
emails.manage_contacts
notifications.manage
```

Brevo credentials and API operations must remain server-side.

A communications user should not receive access to secrets merely because they can manage email operations.

---

## 23.1 Entitlement Permissions

Entitlements may be granted by hand as well as earned by purchase — note 07 §29 lists
"Manual administrative grant" as a first-class entitlement source. The Admin system
therefore needs an entitlement-management area, and it is a high-privilege one: granting an
entitlement gives a customer paid access without payment.

Permissions:

```text
entitlements.read
entitlements.grant
entitlements.adjust
entitlements.revoke
```

- `read` — view a customer's entitlements, their source and their state
- `grant` — create an entitlement by hand
- `adjust` — change a consumable entitlement's remaining quantity or its expiry
- `revoke` — end an entitlement before its natural expiry

`entitlements.read` is the only one of the four that should be granted broadly. A support
role may legitimately need to see why a customer can or cannot access something without
being able to change it.

`grant`, `adjust` and `revoke` are owner/admin-level by default (§10) and should not be
attached to a specialist role without a deliberate decision. They are economically
equivalent to issuing free product, and `revoke` removes access a customer may have paid
for.

Required behaviour:

- **A manually granted entitlement must remain identifiable as such.** It records its source
  as an administrative grant (note 07 §29) and never becomes indistinguishable from a
  purchased entitlement — financial reconciliation depends on telling them apart.
- **Every grant, adjustment and revocation is audited** under §31, recording the acting
  user, the customer, the entitlement, the before and after state, and a reason.
- **A reason is required, not optional.** A manual grant with no recorded reason is
  indistinguishable from an error or an abuse of privilege.
- **Revocation does not delete history.** Per note 07 §40, historical entitlement records
  are retained for reporting, support and reconciliation.
- **Granting is a server-side operation** behind the trusted boundary (§30), never driven by
  a client-supplied user identifier.

---

# 24. Admin Navigation and Permissions

Admin navigation should reflect the user's permissions.

For example:

```text
Admin
├── Dashboard
├── Users
├── Products
├── Courses
├── Bookings
└── ...
```

A user without `courses.read` should not see Courses in the Admin navigation.

However:

```text
Hidden navigation
≠
Security
```

The underlying route and operation must still enforce the permission.

---

# 25. Admin Route Protection

Every `/admin/...` route must perform an appropriate authorization check.

Conceptually:

```text
Request
   ↓
Authenticated session?
   ↓
   ├── No → Sign in
   │
   └── Yes
        ↓
      Admin role?
        ↓
        ├── No → Access denied
        │
        └── Yes
             ↓
         Permission check
             ↓
             ├── No → Access denied
             │
             └── Yes → Continue
```

For resource-specific operations, perform an additional resource ownership/scope check where required.

## 25.1 Staff Multi-Factor Authentication

Every staff account — `owner`, `admin` and every operational role — must hold a verified
WebAuthn factor. Customers may enrol one but are never required to (note 05 §11.1).

Admin access therefore requires three things, not two:

```text
Authenticated user
        +
Verified WebAuthn factor for this session   (aal2)
        +
Appropriate permission
```

The requirement is proportionate to what these accounts can do. `entitlements.grant` hands
a customer paid access without payment; `roles.manage` can create another administrator.
Those are the credentials worth stealing, and a password alone is what gets stolen.

**Enforcement runs at every layer, not only the interface:**

```text
Proxy            coarse session check only — never sufficient
Server Action    refuses an aal1 session before doing any work
Route Handler    same
RLS policy       administrative predicates require aal2
```

The database check matters most. A UI that hides the button still leaves the Server Action
callable, and a Server Action that checks alone still leaves a stolen `aal1` token able to
query the table directly. Requiring `aal2` in the policy makes the row unreachable no
matter which layer above it was bypassed.

**One layer sits below even that: who may call the function at all.** RLS governs tables;
it says nothing about `SECURITY DEFINER` functions, which run with their owner's rights and
so pass straight through every policy above. The `admin_*` operations are deliberately
callable by any signed-in session — they must be, because each reads `auth.uid()` to decide
whether the caller qualifies — so the grant is not the control and was never meant to be:
`assert_admin_action()` is. A customer calling `admin_set_role` is refused for want of
permission, exactly as an owner without `aal2` is.

But that reasoning only holds while the *privileged* functions — order fulfilment, the
outbox, the maintenance jobs — are unreachable by an anonymous caller, and PostgreSQL's
default grants make them reachable unless explicitly closed. See note 08 §61.1, which
records the rule, the silent way of getting it wrong, and the fact that this project had it
wrong.

A staff member who has not yet enrolled can sign in and is sent to enrolment. They reach
nothing privileged until it is complete.

**One key admits; two are required of the owner.** A second key is lockout insurance rather
than additional proof of identity, so staff are prompted for one instead of being blocked.
The owner is the exception — that account cannot be recovered by anyone else, so
`assert_admin_action()` refuses its privileged operations until two verified keys exist
(note 05 §11.1).

Factor recovery is an administrative, audited operation (§31), never self-service —
otherwise MFA is only as strong as the email account behind it.

---

# 26. Server-Side Authorization Helpers

Authorization logic should be centralized into reusable server-side helpers.

For example, conceptually:

```text
requireAdmin()
requirePermission("courses.update")
canManageBooking(bookingId)
```

The actual implementation names can differ.

The important principle is that authorization rules should not be duplicated inconsistently throughout the application.

---

# 27. Client-Side Authorization

Client-side permission information may be used to improve the user experience.

For example:

```text
No permission
→ Do not display the button
```

But the server must still enforce:

```text
No permission
→ Reject operation
```

Client-side authorization is therefore a UX layer, not the security boundary.

---

# 28. Supabase RLS

Supabase Row Level Security should provide database-level protection where appropriate.

Customer-owned records should generally be restricted to their owner.

Administrative records and operations require an appropriate RLS strategy.

Do not assume that because a request came from `/admin` it is trusted by PostgreSQL.

The database must receive appropriate security context and policies.

---

# 29. Service Role

The Supabase service-role key is highly privileged.

It must:

- Remain server-side
- Never be exposed to the browser
- Never be committed to GitHub
- Be used only when genuinely required

Elevated access must not become a shortcut around the application's authorization architecture.

Where a normal authenticated database operation can safely use RLS, prefer that approach.

---

# 30. Admin Actions

UI-triggered Admin mutations should use appropriate Server Actions or Route Handlers.

Example:

```text
Admin clicks "Publish Course"
        ↓
Server Action
        ↓
Authenticate user
        ↓
Check permission
        ↓
Validate input
        ↓
Perform operation
        ↓
Return result
```

External systems/webhooks should use Route Handlers where appropriate.

---

# 31. Admin Auditability

Important administrative actions should be auditable.

Examples:

- Role changes
- Product changes
- Membership changes
- Entitlement grants, adjustments and revocations
- Refunds
- Booking changes
- Content publication
- User deactivation
- Account deletion
- Major configuration changes

An audit record may include:

- Acting user
- Action
- Resource
- Resource ID
- Timestamp
- Relevant metadata

Do not store sensitive secrets in audit logs.

The final audit-log schema will be defined with the database architecture.

---

# 32. Sensitive Operations

High-impact operations should receive additional safeguards where appropriate.

Examples:

- Changing owner/admin roles
- Refunds
- Granting, adjusting or revoking entitlements
- Deleting users
- Deleting important content
- Changing critical settings
- Bulk operations

Possible safeguards include:

- Confirmation
- Permission checks
- Re-authentication where appropriate, including a fresh WebAuthn assertion (§25.1)
- Audit logging
- Soft deletion
- Transactional processing

The exact safeguards should be selected according to the risk of each operation.

---

# 33. Least Privilege

Use the principle of least privilege.

Each role should receive only the access required to perform its responsibilities.

For example:

```text
Course Manager
→ Course management

Booking Manager
→ Booking management

Finance Manager
→ Financial operations

Communications Manager
→ Email operations
```

Do not give every staff member full Admin access simply because it is easier to implement.

---

# 34. Owner Protection

The owner role should be particularly protected.

The application should not allow an ordinary administrator to silently elevate themselves to owner.

Owner role changes should require appropriate privileged authorization.

The exact mechanism can include:

- Owner-only operations
- Strong confirmation
- Audit logging
- Additional authentication where appropriate

---

# 35. Authorization and Entitlements

Administrative authorization must not be confused with customer entitlements.

Example:

```text
Customer
   ↓
Gold Membership
   ↓
Gold entitlements
   ↓
Academy access
```

versus:

```text
Staff user
   ↓
course_manager
   ↓
Permission to manage courses
```

These are two different authorization systems serving different purposes.

---

# 36. Public Content vs Admin Content

Public content can be viewed without Admin authorization.

Admin access is required to manage it.

For example:

```text
Visitor
→ /catalogue/books
→ Read public content

Content Manager
→ /admin/content
→ Create/edit/publish content
```

The public user's ability to view content must not imply any ability to modify it.

---

# 37. Admin Workspace Navigation

The Admin workspace should use the prominent contextual navigation established in Architecture Note 4.

It should not expose the entire public navigation as its primary menu.

The Admin user should have an obvious route back to:

```text
/
```

and to relevant customer/account areas when appropriate.

---

# 38. Authorization Failure UX

When a user is authenticated but lacks permission, do not pretend the route does not exist if a clear authorization response is more appropriate.

Use an appropriate:

```text
403 / Access Denied
```

experience.

When a user is not authenticated, redirect to authentication where appropriate.

Do not reveal sensitive information about protected resources through error messages.

---

# 39. Role Storage

Roles and permissions should be represented in the application/database architecture rather than only inside frontend code.

A possible conceptual model is:

```text
users
  ↓
user_roles
  ↓
roles
  ↓
role_permissions
  ↓
permissions
```

The final relational schema will be defined in the database architecture note.

The implementation may simplify this model if the actual requirements remain small, but it must remain extensible.

---

# 40. Technology Requirement

Use the latest stable, production-safe Next.js, Supabase and TypeScript patterns available when implementation begins.

Verify current recommended approaches for:

- Server-side authorization
- Supabase RLS
- Supabase Auth
- Next.js route protection
- Server Actions
- Route Handlers
- Cookies/session handling

Do not copy outdated authorization examples from older Next.js or Supabase versions.

---

# 41. Authorization Model Summary

```text
                         USER
                           │
                  ┌────────┴─────────┐
                  │                  │
              CUSTOMER              STAFF
                  │                  │
          Entitlements          Roles / Permissions
                  │                  │
          ┌───────┼───────┐   ┌──────┼────────────┐
          │       │       │   │      │            │
       Courses Membership Bookings Content     Finance
```

Customer entitlements control what the customer can access.

Staff roles and permissions control what operational users can manage.

These must remain separate.

---

# 42. Architectural Principle

The authorization architecture should provide:

**Least privilege, centralized permission logic, server-enforced access, database-level protection, auditable administrative operations and a clear separation between customer entitlements and staff permissions.**

No user should gain privileged access merely by manipulating the browser, URL, client state or request payload.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1). Box-drawing characters, arrows and symbols restored to `├── └── │ ┌ ┼ ┴ ─ ↓ → ≠ —`; the `≠` in §11 and §24, and the `→` in the §25 decision tree, reconstructed from context. Column alignment in the §41 diagram was normalized. No wording was altered. |
| 2026-08-28 | §8, §10, §23.1 (new), §31, §32: entitlement-management permissions (`entitlements.read/grant/adjust/revoke`) defined, added to the permission matrix as owner/admin-level, with mandatory audit and a required reason for manual grants. Closes R18. Numbered 23.1 so that no existing section number changes. |
| 2026-08-28 | §8, §10, §18: `blog.*`, `catalogue.*` and `masterclasses.*` permissions defined and added to the permission matrix; recorded that Blog and Catalogue are first-class managed content domains with Admin areas at `/admin/blog` and `/admin/catalogue`, naturally held by `content_manager`. Supports R15 and R8. |
| 2026-08-29 | §25.1 (new), §32: WebAuthn MFA made mandatory for every staff role, enforced as `aal2` in Server Actions, Route Handlers and RLS policies rather than in the interface; customers may enrol optionally. Factor recovery is administrative and audited, never self-service. Numbered 25.1 so no existing section number changes. |
| 2026-08-31 | §25.1: recorded that one verified key admits any staff member while the owner requires two before privileged actions, matching the enforcement added in migration 0014. |
| 2026-09-02 | §25.1: recorded the layer beneath RLS — function `EXECUTE` privileges. The `admin_*` operations are intentionally callable by any signed-in session, since each derives the caller from `auth.uid()`; `assert_admin_action()` is the control, not the grant. Cross-references note 08 §61.1, opened after every `SECURITY DEFINER` function was found callable by anyone holding the anon key. |
| 2026-09-05 | §13.1 (new): `/admin/roles` recorded as the READ view of the permission matrix — built from `roles`, `role_permissions` and `user_roles` so a migration-added role appears without a code change — with granting kept on the person's own page, where the context for the decision is. |
| 2026-09-05 | §14.1 (new): `team_members.user_id` recorded (migration 0034). Public team membership and staff roles are independent facts: the link is nullable because the seeded biographies have no accounts, unique so one account cannot appear twice, and `ON DELETE SET NULL` so deleting an account never removes published content. |
| 2026-09-05 | §13.1: role assignment implemented on `/admin/users/[id]` through `admin_set_role`, called with the operator's own session and requiring a reason. Verified end to end against a local database: an owner holding two keys granted and revoked a role, and both directions produced the expected `audit_logs` entry naming the owner as actor. |
| 2026-09-05 | §14.2 (new): user invitations recorded — a new `users.invite` permission (migration 0035) held by owner and admin, an invitation rather than an operator-chosen password, a narrow `admin_record_user_invite` audit function, and the account withdrawn if the audit entry cannot be written. The invite email must use `{{ .TokenHash }}`: GoTrue's default returns the session in a URL fragment the server can never read. Name search recorded, with its documented limit that email addresses are not searchable. |
| 2026-09-05 | §14.1: the admin control implemented — create, link or unlink a public team entry from the person's page, with linking never inferred and unlinking never deleting content. |
| 2026-09-05 | §14.3 (new): `users.reset_mfa` and `admin_record_mfa_reset` (migration 0036) — the recovery lever note 05 §11.1 always described but which did not exist. Needed now that customers are challenged for keys they registered, since a lost key otherwise means a permanently unreachable account. |
