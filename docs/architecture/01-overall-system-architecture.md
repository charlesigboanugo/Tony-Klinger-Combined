# Tony Klinger — Overall System Architecture

**File:** `01-overall-system-architecture.md`

## 1. Project Objective

Build a single, production-ready web application for **Tony Klinger** at:

`https://tonyklinger.com`

The application should combine Tony Klinger's public website, commercial offerings, customer learning/delivery environment, customer account, administration system, payments, bookings, email communications and supporting backend processes into one coherent platform.

The architecture must be extensible so that new products, services, content, events and business processes can be added later without requiring a fundamental rewrite.

The application should be designed as a real production system rather than only as a marketing website or visual prototype.

---

## 2. Application Architecture

Use:

* One primary domain: `tonyklinger.com`

**Domain status, recorded 2026-09-03.** `tonyklinger.com` is the *target* domain and does
not currently resolve — it has no DNS records at all. The existing Wix site being replaced
is live at `www.tonydklinger.com` (note the `d`), and the intention is to move to
`tonyklinger.com` at or after cutover. This is not cosmetic, because several parts of the
system bind to the domain and each must be updated deliberately when it changes:

```text
Livid              domain allowlist for video playback (§40.1 of note 09) — a
                   changed domain silently breaks every embedded player
Supabase Auth      allowed redirect URLs, email link host
Stripe             Checkout return URLs, webhook endpoint
CSP                any host-based directive in proxy.ts
SEO                redirects from the old site's URLs (note 03 §38)
```

Until the move happens, nothing should hard-code either domain; the host belongs in
configuration, as note 08 §60.1 already requires for storage URLs.
* One Next.js application
* Next.js App Router
* `src/` source-directory convention
* Supabase as the primary backend/database platform
* Stripe for payments and subscriptions
* Brevo for email and email templates

Do not create separate subdomains or separate applications for the Academy, Admin or Account areas.

Use routes to separate the major application areas.

Core routes include:

```text
/                    Public website
/coaching            Coaching/product storefront
/academy             Learning and delivery environment
/account             Global customer account
/admin               Administration
/auth                Authentication
/cart                Shopping cart
/checkout            Checkout
/bookings            Booking flows
/api                 HTTP endpoints/integrations
```

Additional routes may be introduced as the application develops.

---

## 3. Public Website

The public website is the main Tony Klinger brand and marketing experience.

It should allow visitors to discover Tony's:

* Work
* Films
* Books
* Media
* Coaching
* Courses
* Memberships
* Cohorts
* Events
* Retreats
* Blog/content
* Other future offerings

Public visitors should generally be able to browse and understand the available products and services without signing in.

The public website should provide clear paths from discovery to product information, purchase, booking or registration where appropriate.

---

## 4. Coaching Storefront

`/coaching` is the main public commercial area for Tony's educational and coaching offerings.

It should present the available offers in a clear and understandable way, including:

* Online Membership
* Courses
* Interactive Cohorts
* Group Coaching
* Private Coaching
* Retreats

The purpose of the Coaching storefront is primarily:

```text
DISCOVER
   ↓
UNDERSTAND
   ↓
SELECT
   ↓
PURCHASE / BOOK
```

The storefront should explain what a customer receives before they purchase.

The Academy should not unnecessarily duplicate the public commercial catalogue.

The distinction is:

```text
COACHING
Public discovery + product information + purchasing/booking

ACADEMY
Authenticated learning + delivery + customer experiences
```

---

## 5. Academy

`/academy` is the authenticated learning and delivery environment.

It is not simply another marketing page.

The Academy should provide access to products and experiences according to the customer's permissions and entitlements.

It may contain:

* Courses
* Lessons
* Course resources
* Cohorts
* Group coaching experiences
* Coaching-related content
* Retreat-related content
* Masterclasses
* Member resources
* Recordings
* Live sessions
* Calendar
* Learning progress

A signed-in customer may have access to different areas depending on what they have purchased or what their membership provides.

Examples include:

* Signed-in user with no purchases
* Course purchaser
* Silver member
* Gold member
* Platinum member
* Ultimate member
* Group coaching customer
* Cohort participant
* Private coaching customer
* Retreat participant
* Customer with several products
* Customer whose access has expired

Access must therefore be based on appropriate authorization and entitlements rather than simply checking whether the user is signed in.

---

## 6. Global Customer Account

`/account` is the customer's global account area.

It is not an Academy-specific account.

A customer should have one identity across the entire Tony Klinger application.

The Account area should provide access to things such as:

* Profile
* Security
* Billing
* Orders
* Membership information
* Notifications
* Account settings
* Relevant bookings

The same account is used for:

* Courses
* Memberships
* Coaching
* Cohorts
* Retreats
* Bookings
* Orders
* Academy access

Customers must not need separate accounts for different products.

The Account interface should remain relatively compact rather than becoming another large application workspace.

---

## 7. Administration

`/admin` is a private operational workspace.

It should use a dedicated Admin interface and navigation rather than displaying the complete public website navigation.

The Admin system should eventually allow authorized personnel to manage areas including:

* Users
* Roles
* Products
* Courses
* Memberships
* Group Coaching
* Cohorts
* Private Coaching
* Retreats
* Bookings
* Events
* Books
* Films
* Media
* Orders
* Payments
* Emails
* Settings

The Admin system must support role-based permissions.

Different authorized users may have different capabilities.

Tony is the business owner and should have an appropriate owner-level role; his role should not be named "Tony".

The exact roles and permissions will be defined in the dedicated Roles & Admin Architecture note.

Admin authorization must be enforced on the server and, where appropriate, at the database level.

Hiding an Admin link from a user is not a security mechanism.

---

## 8. Authentication

Use Supabase Auth as the central authentication system.

There should be one customer identity throughout the application.

Authentication is relevant to:

* Academy
* Account
* Purchases
* Bookings
* Memberships
* Learning
* Admin access

A guest should be able to discover public products and services.

A guest may also encounter Academy pages that explain the Academy or provide a sign-in entry point, but protected customer content must require authentication and appropriate entitlement.

---

## 9. Product Architecture

The application must not be designed around a fixed list of today's products.

It should support configurable product types such as:

* Membership
* Course
* Group Coaching
* Coaching Bundle
* Interactive Cohort
* Private Coaching
* Retreat
* Event
* Future product types

A product may have:

* Name
* Description
* Product type
* Images
* Pricing
* Availability
* Purchase rules
* Booking requirements
* Entitlements
* Membership relationships
* Stripe references
* Delivery configuration

The commercial catalogue should be data-driven wherever practical so products can be added or modified without rewriting the application's core architecture.

---

## 10. Membership Model

The membership structure is cumulative:

```text
Silver
   ↓
Gold
   ↓
Platinum
   ↓
Ultimate Membership
```

Each higher membership tier inherits the benefits of the previous tier and adds additional benefits.

### Silver

* 1 video playlist
* 1 group series (8 sessions)

### Gold

Everything in Silver, plus:

* 1 additional group series

Therefore:

* 2 group series total
* 16 sessions total

Gold also includes the defined Gold-level benefits such as the broader playlist access and Q&A benefits.

### Platinum

Everything in Gold, plus:

* All 4 group series
* 32 sessions total
* Virtual retreats
* New courses added during membership

### Ultimate Membership

Everything in Platinum, plus:

* Unlimited cohort access
* New releases
* Masterclasses
* Partner discounts
* Downloadable resources

The exact membership benefits, prices and entitlements should be represented as configurable data rather than scattered throughout application code.

Membership should not automatically make every premium service free unless that benefit is explicitly included in the membership's entitlements.

---

## 11. Payment, Entitlement and Booking

The system must maintain a strict distinction between:

```text
PAYMENT ≠ ENTITLEMENT ≠ BOOKING
```

### Payment

Represents the financial transaction.

Examples:

* Course payment
* Membership payment
* Coaching payment
* Retreat payment

### Entitlement

Represents what the customer is allowed to access or use.

Examples:

* Course access
* Membership benefits
* Group series access
* Coaching-session credits
* Cohort access
* Retreat access

### Booking

Represents a specific reservation.

Examples:

* A particular group coaching session
* A private coaching appointment
* A retreat place
* An event registration

The general relationship is:

```text
PAYMENT
   ↓
ORDER
   ↓
ENTITLEMENT
   ↓
ACCESS / BOOKING
```

A valid entitlement must be recognized before requesting another payment.

For example, if a membership includes a particular coaching service, the customer should not be charged again when booking that covered service.

---

## 12. Shopping and Checkout

The application should support both one-time purchases and recurring subscriptions, and
both guest and signed-in checkout. A customer is not required to hold an account before
paying; a guest purchase is linked to an account afterward through the claim process
defined in note 05 §29.

The general commercial flow is:

```text
PRODUCT
   ↓
PRODUCT DETAILS
   ↓
ADD TO CART / BUY NOW
   ↓
CART
   ↓
CHECKOUT
   ↓
STRIPE
   ↓
PAYMENT CONFIRMATION
   ↓
ORDER
   ↓
ENTITLEMENT
   ↓
ACCESS / BOOKING
```

The cart should support appropriate features such as:

* Add to cart
* Remove
* Quantity
* Side cart
* Full cart
* Totals
* Coupons where applicable
* Continue shopping
* Checkout
* Empty state
* Appropriate persistence

Membership/subscription checkout may have different requirements from ordinary product purchases.

---

## 13. Booking Architecture

Booking is separate from payment.

The system must support several scenarios.

### Customer Pays Then Books

```text
Select service
   ↓
Payment
   ↓
Entitlement
   ↓
Select date/time
   ↓
Booking
   ↓
Confirmation
```

### Member Books Using Entitlement

```text
Active membership
   ↓
Eligible entitlement
   ↓
Select date/time
   ↓
Booking
   ↓
Confirmation
```

No second payment should be requested if the customer's valid entitlement already covers the service.

### Application-Based Experience

Some retreats or premium experiences may require:

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

The booking system should support:

* Availability
* Capacity
* Dates
* Times
* Session types
* Bookings
* Cancellation
* Rescheduling
* Attendance
* Entitlement consumption

---

## 14. Group Coaching and Interactive Cohorts

These must remain distinct concepts.

### Group Coaching

Group Coaching represents smaller coaching sessions and programmes.

The existing offering includes:

* Up to 8 people
* One-hour sessions
* Individual session purchase
* 8-session bundles
* Four group series
* Membership-based access where applicable

Each group series consists of multiple sessions.

The four existing series are:

* Filmmaking
* Writing
* Producing
* For All Filmmakers

Together these contain:

```text
4 series × 8 sessions = 32 sessions
```

### Interactive Cohorts

Cohorts are structured programmes and should not simply be treated as another name for Group Coaching.

The existing proposition describes cohorts as:

* Silver
* Gold
* Platinum
* 8 × 3-hour workshops
* 24 total hours

The detailed product and delivery rules will be defined in the Product/Academy architecture note.

---

## 15. Events and Retreats

Events and retreats should be treated as first-class application concepts where the business requires them.

The system should be capable of supporting:

* Event information
* Event registration
* Event capacity
* Event payment
* Event booking
* Retreat information
* Retreat applications
* Interviews
* Selection
* Registration
* Payment
* Attendance

A specialized external events/booking platform should not be assumed as the default.

The application should initially support its own event and booking workflows where appropriate.

If operational complexity later becomes high, an external specialized platform may be integrated without redesigning the core commercial model.

---

## 16. External Services

### Supabase

Use Supabase for:

* Authentication
* PostgreSQL database
* Row Level Security
* Storage where appropriate
* Database functions
* Database triggers
* Edge Functions where appropriate

### Stripe

Use Stripe for:

* Payments
* Stripe Checkout
* Subscriptions
* Customers
* Invoices
* Coupons/promotions
* Payment lifecycle
* Customer Portal where appropriate
* Webhooks

### Brevo

Use Brevo for:

* Transactional email
* Email templates
* Customer communications
* Appropriate email-list operations

Email templates should remain managed in the agreed Brevo template system rather than unnecessarily duplicating the templates throughout the application.

---

## 17. Server-Side Architecture

Use modern Next.js server capabilities appropriately.

### Server Components

Use Server Components for:

* Server-rendered UI
* Initial page data
* Secure server-side data retrieval
* Data-dependent rendering

### Server Actions

Use Server Actions for:

* User-triggered server-side operations
* Mutations
* Secure operations initiated from the application's UI

Examples include:

* Updating profile information
* Updating preferences
* Performing application mutations
* Initiating appropriate purchase operations

### Route Handlers

Use Route Handlers for operations that require an HTTP endpoint.

Examples:

* Stripe webhook
* External callbacks
* Other external integrations

Example:

```text
/api/stripe/webhook
```

### Supabase Edge Functions

**Integration boundary decision.** Payment, entitlement and business logic — including
Stripe webhook processing — lives in the Next.js/Vercel server layer. Supabase provides
PostgreSQL, Auth, Row Level Security and Storage. Vercel Cron is the primary scheduler
(§18).

Supabase Edge Functions are therefore not the default home for background processing. Use
one only where a requirement is genuinely database-specific and cannot reasonably be served
from the Next.js server layer.

The same business operation must never be implemented in both places.

---

## 18. Background and Non-UI Processing

The architecture must support processes that are not directly triggered by a user interface.

Examples include:

* Stripe webhook processing
* Subscription reconciliation
* Expired entitlement cleanup
* Expired booking cleanup
* Email-list synchronization/cleanup
* Scheduled maintenance
* Database cleanup
* User deletion cleanup
* Related-record cleanup
* Notification processing
* Other scheduled jobs

The mechanisms are:

* **Vercel Cron** — the single primary scheduler. Scheduled jobs invoke secured Next.js
  Route Handlers under `/api/cron/`.
* **Next.js Route Handlers** — for anything requiring an HTTP endpoint, including the
  Stripe webhook and the cron entry points.
* **PostgreSQL triggers and constraints** — for guarantees that genuinely belong at the
  database level.
* **Reusable functions in `src/lib`** — where the work itself lives, so a job's logic can be
  invoked from a scheduled route, a webhook or an admin action without being written twice.
* **Supabase Edge Functions** — only for genuinely database-specific requirements (§17).

Supabase Cron is not introduced as a competing scheduler.

Each scheduled process has exactly one implementation. The scheduled route is a thin
authenticated entry point that calls the shared `src/lib` operation; it does not contain a
second copy of the logic.

---

## 19. Database Architecture

Use Supabase PostgreSQL as the application's primary database.

The database schema is a first-class part of the project.

Schema changes must be represented through migration files and tracked in GitHub.

The system is expected to require entities such as:

* Users
* Profiles
* Roles
* Products
* Prices
* Membership Plans
* Membership Subscriptions
* Courses
* Modules
* Lessons
* Resources
* Group Coaching Programmes
* Coaching Sessions
* Cohorts
* Cohort Workshops
* Private Coaching Services
* Retreats
* Retreat Applications
* Events
* Orders
* Order Items
* Payments
* Stripe Customers
* Entitlements
* Bookings
* Enrolments
* Attendance
* Coupons
* Notifications
* Email-related records
* Availability

The detailed schema will be defined in the dedicated Supabase/Database architecture note.

---

## 20. Version-Controlled Supabase Schema

The Supabase schema must not exist only in the Supabase Dashboard.

Maintain the database structure in the project using migrations, for example:

```text
supabase/
├── migrations/
├── functions/
├── seed.sql
└── config.toml
```

Migrations should be committed to GitHub.

This makes the database structure reproducible across development, testing and production environments.

---

## 21. Navigation and Application Workspaces

Different parts of the application should have appropriate navigation.

### Public Website

Uses the main Tony Klinger public navigation.

### Academy

Uses a prominent contextual Academy navigation because Academy is a substantial learning workspace.

### Admin

Uses a prominent contextual Admin navigation because Admin is a substantial operational workspace.

### Account

Uses a compact account-focused menu rather than a large application workspace.

### Checkout and Authentication

Use minimal navigation so users remain focused on the task.

The Tony Klinger logo/brand should provide an obvious route back to the main public site where appropriate.

---

## 22. UI and Theme Architecture

The application must use a centralized design system.

The design system must support:

* Light mode
* Dark mode
* Centralized colour variables/tokens
* Easily changeable primary colours
* Secondary colours
* Accent colours
* Typography
* Spacing
* Consistent UI components
* Gradients
* Appropriate imagery
* Image placeholders
* Accessible interfaces

Changing the overall visual theme should be possible centrally rather than requiring colours to be changed manually throughout individual components.

The design should avoid making every page look like a generic collection of cards.

Important pages should use varied, attractive and content-appropriate layouts.

---

## 23. Responsive Design

The application must work correctly across:

* Desktop
* Laptop
* Tablet
* Mobile

The navigation must adapt to available screen space.

Desktop navigation must not allow items to become clipped or disappear as the viewport becomes smaller.

The mobile navigation must be clearly visible and usable when opened.

Navigation sizing should be balanced:

* Not unnecessarily large
* Not too small
* Clear hierarchy
* Appropriate spacing
* Touch-friendly controls

---

## 24. Security

Security must be enforced independently of the visual interface.

Use:

* Supabase Auth
* Server-side authorization
* Role-based access control
* Supabase RLS
* Secure environment variables
* Stripe webhook signature verification
* Input validation
* Ownership checks
* Entitlement checks
* Protected Admin routes

Frontend visibility alone must never determine authorization.

A customer must not be able to access another customer's:

* Orders
* Courses
* Bookings
* Membership information
* Private account information

Admin permissions must also be enforced server-side and not merely by hiding navigation items.

---

## 25. Extensibility

The architecture must not assume that Tony's current catalogue is permanent.

It should allow future:

* Courses
* Membership tiers
* Coaching services
* Cohorts
* Retreats
* Events
* Masterclasses
* Digital resources
* Physical experiences
* Other commercial products

The system should therefore favor configurable products, prices, entitlements, access rules and booking rules over hard-coded assumptions.

---

## 26. Technology Version Policy

Use the **latest stable, production-safe versions** of the technologies and packages used by the project at the time implementation begins.

This includes, where applicable:

* Next.js
* React
* TypeScript
* Supabase libraries
* Stripe libraries
* Brevo integrations
* Tailwind CSS
* ESLint
* Other project dependencies and development tooling

Do not intentionally use old package versions merely because they appeared in previous examples or previous project scaffolding.

Before implementation, verify the current stable versions and use their current recommended APIs and patterns.

Avoid deprecated or legacy approaches where a current stable replacement exists.

Do not use experimental features merely because they are available; prefer stable production features unless an experimental feature is specifically justified.

---

## 27. Overall System Model

The overall application can be understood as:

```text
                         TONYKLINGER.COM
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
          PUBLIC             ACADEMY             ADMIN
             │                  │                  │
       Marketing +          Learning +        Operations +
        Storefront            Delivery          Management
             │                  │                  │
             └──────────────────┼──────────────────┘
                                │
                             ACCOUNT
                                │
                  ┌─────────────┼─────────────┐
                  │             │             │
               SUPABASE       STRIPE        BREVO
               Auth/DB       Payments        Email
                  │
            PostgreSQL
             + RLS
             + Storage
             + Functions
             + Triggers
```

The principal commercial model is:

```text
PRODUCT
   ↓
PRICE
   ↓
PAYMENT
   ↓
ORDER
   ↓
ENTITLEMENT
   ↓
ACCESS / BOOKING
   ↓
DELIVERY
```

The principal membership model is:

```text
SILVER
   ↓
GOLD
   ↓
PLATINUM
   ↓
ULTIMATE MEMBERSHIP
```

Membership tiers are cumulative.

The core business distinction remains:

```text
PAYMENT ≠ ENTITLEMENT ≠ BOOKING
```

---

## 28. Production Objective

The application should not simply reproduce the existing website's visual structure.

It should provide a coherent platform in which customers can understand:

* What they are buying
* What the product includes
* Whether it is a membership, course, coaching service, cohort, retreat or event
* Whether payment is required
* Whether booking is required
* Whether an existing entitlement covers the service
* What access they receive
* How long access lasts
* When membership renews
* Where purchased content is delivered
* Where bookings are managed
* What happens if payment fails
* What happens when access expires
* What happens when a purchase or booking is cancelled

The system must treat the following as first-class production concerns:

* Products
* Prices
* Cart
* Checkout
* Payments
* Subscriptions
* Orders
* Entitlements
* Memberships
* Courses
* Group Coaching
* Cohorts
* Private Coaching
* Retreats
* Events
* Bookings
* Calendar
* Email
* Notifications
* Customer Account
* Administration
* Background Processing
* Database
* Security

No major customer or administrative journey should be intentionally left as an incomplete placeholder in the production architecture.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | Initial version recorded as supplied. |
| 2026-08-28 | §12: recorded that checkout supports both guest and signed-in customers, cross-referencing the claim process in note 05 §29. Supports R12. |
| 2026-08-28 | §17, §18: integration boundary recorded — payment and business logic including Stripe webhooks in the Next.js/Vercel server layer, Supabase as PostgreSQL/Auth/RLS/Storage, Vercel Cron as the single primary scheduler invoking secured Route Handlers under `/api/cron/`. Supabase Edge Functions reduced to genuinely database-specific cases; Supabase Cron explicitly not adopted. Closes R22. |
