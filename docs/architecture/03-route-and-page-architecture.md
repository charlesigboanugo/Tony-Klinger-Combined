# Tony Klinger — Route & Page Architecture

**File:** `03-route-and-page-architecture.md`

## 1. Purpose

Define the URL and page structure of the Tony Klinger application.

This note establishes:

- The main public website routes
- The Coaching/storefront routes
- The Academy routes
- The Account routes
- The Admin routes
- Authentication routes
- Cart and checkout routes
- Booking routes
- API route areas
- Route-level layout boundaries

This is a route/page specification. It does not define the full database schema, detailed permissions model, or detailed UI component architecture.

---

## 2. Core Route Model

The application uses one primary domain:

`tonyklinger.com`

The major route areas are:

```text
/
├── Public Website
├── /coaching
├── /academy
├── /account
├── /admin
├── /auth
├── /cart
├── /checkout
├── /bookings
└── /api
```

The application may introduce additional routes as future requirements arise.

Do not create a separate application or subdomain merely because a new route area is introduced.

---

# 3. Public Website

The public website is the main Tony Klinger brand experience.

The main public navigation should represent the principal public destinations rather than exposing every route in the application.

The current public site provides the following primary areas:

```text
Home
Coaching
About
Blogs
Catalogue
Contact
```

The new application should preserve the important public content and commercial destinations while improving the information architecture.

A proposed public structure is:

```text
/
├── /about
├── /blog
├── /catalogue
├── /contact
├── /events
└── /coaching
```

Additional public content routes may sit beneath the relevant section.

Secondary public pages that belong in the footer rather than the primary menu — the legal
routes defined in §8.2 — sit outside this structure.

---

# 4. Home

```text
/
```

The Home page is the primary public landing page.

It should introduce Tony Klinger and provide clear routes to the principal areas of the site.

The Home page should not attempt to display the entire application.

It should guide visitors toward relevant destinations such as:

- About
- Catalogue
- Coaching
- Blog/content
- Contact

---

# 5. About

```text
/about
```

The About section contains public information about Tony Klinger and related background/content.

About is a **section, not a single page**:

```text
/about                    Tony's Story — the biography
/about/team               Meet the Team
/about/testimonials       Testimonials
```

Additional About pages should only be introduced when the content genuinely requires separate destinations. These three meet that test, and the reasoning is recorded because the default is one page:

- **Meet the Team is about other people.** Its copy runs to roughly four times the length of Tony's own biography. Inlined it did two things badly — it buried the team beneath a long biography, and it made the biography read as a preamble to someone else's story. Tony himself is excluded from this page by slug, since he is the subject of `/about`; listing him in both would put one person at two URLs (§37).
- **Testimonials are a data-driven view, not prose.** They live in their own table and the same component already renders a short selection on the home page and the coaching storefront. This page is where "see all" leads — one data source, one component, three placements, no second copy of the quotes. It deliberately applies no `context` filter, unlike the selections elsewhere: a visitor who came looking for proof should see all of it rather than a slice chosen for another page's purpose.

---

# 6. Blog

```text
/blog
```

The public blog/content area should support:

```text
/blog
/blog/[slug]
```

The index displays available articles.

The dynamic route displays an individual article.

The exact content management implementation is defined elsewhere.

---

# 7. Catalogue

```text
/catalogue
```

The Catalogue is the public discovery area for Tony Klinger's work and media.

The existing site catalogue contains destinations including:

- Watch
- The Havana Chronicles
- Audio
- Stories From The Front Line
- Film
- Books
- Interviews
- Follow Your Dreams Podcast
- The Tony Klinger Podcast
- Tony Klinger YouTube
- Light's, Chutzpah, Action!!
- Solo2Darwin

These should be represented in the new application according to their actual content type rather than necessarily reproducing the old Wix menu literally.

`/catalogue` is the Catalogue hub. Its categories are:

```text
/catalogue
/catalogue/books
/catalogue/films
/catalogue/audio
/catalogue/interviews
/catalogue/stories-from-the-front-line
/catalogue/podcasts
/catalogue/watch
```

These seven categories are the only top-level Catalogue destinations.

**Individual works are detail pages, not categories.** The Havana Chronicles, Solo2Darwin
and Lights, Chutzpah, Action!! are individual works and live as detail pages inside whichever
category they belong to — for example `/catalogue/films/the-havana-chronicles`. They are not
top-level Catalogue entries, and the old Wix menu is not reproduced as a route structure.

Because the category set is fixed and data-driven, the seven categories may be implemented
either as explicit route segments or as a single `[category]` segment validated against the
known set. Either way the URLs above are canonical.

Where an item is an external website or external platform, the application should link to the external destination rather than unnecessarily rebuilding it.

Examples include external podcast/video destinations where appropriate.

---

# 8. Content Detail Routes

Where Tony has collections of content, use a consistent collection/detail model.

For example:

```text
/catalogue/books
/catalogue/books/[slug]

/catalogue/films
/catalogue/films/[slug]

/catalogue/audio
/catalogue/audio/[slug]

/catalogue/interviews
/catalogue/interviews/[slug]

/catalogue/stories-from-the-front-line
/catalogue/stories-from-the-front-line/[slug]

/catalogue/podcasts
/catalogue/podcasts/[slug]

/catalogue/watch
/catalogue/watch/[slug]
```

Every category follows the same collection/detail model.

Where a work lives entirely on an external platform — a podcast host, a YouTube channel, a
separate site — the catalogue entry links out to it rather than rebuilding it internally
(§36). An entry may therefore be an internal detail page or an external link, and the data
model records which.

Do not create a separate route hierarchy for every individual item unless there is a genuine need for a dedicated page.

---

# 8.1 Events

```text
/events
/events/[slug]
```

Events are first-class public offerings, not administrative records only.

The index presents forthcoming and past events. The dynamic route presents an individual
event.

A public event page should explain:

- What the event is
- When and where it takes place
- Who it is for
- Whether a place must be registered or booked
- Whether payment is required
- Capacity or availability where relevant

Where an event requires a place to be reserved, registration follows the same model as
every other reservation in the application:

```text
Event
   ↓
Registration / payment where applicable
   ↓
Order and entitlement where applicable
   ↓
Booking
   ↓
Attendance
```

An event that is free to attend still produces a booking, because capacity and attendance
must be tracked.

Events are administered under `/admin/events`.

An event is distinct from a retreat and from a cohort. Retreats have their own commercial
workflow under `/coaching/retreats`, and cohorts are a coaching product under
`/coaching/cohorts`. `/events` is for public events that are not part of the coaching
product catalogue.

---

# 8.2 Legal Pages

```text
/privacy
/terms
/cookies
```

These are public, indexable pages linked from the public footer (note 04 §8).

They are kept at the top level rather than grouped under a `/legal` prefix. The URLs are
short, conventional and widely linked from outside the application; a `/legal` segment
would add nesting without adding meaning, and these paths are what customers, browsers and
compliance tooling expect to find.

Each is a single static content page. They require no session, no entitlement and no
dynamic segment.

---

# 9. Coaching

```text
/coaching
```

Coaching is a major public commercial area.

It is responsible for discovering, explaining and purchasing/booking Tony Klinger's coaching and educational offerings.

The existing Coaching site has the following broad concepts:

- About/How it works
- Group Sessions
- Shop
- Membership
- Virtual Retreats
- Contact

The new application should organize these concepts into a coherent route structure.

A baseline structure is:

```text
/coaching
├── /about
├── /memberships
├── /courses
├── /group-coaching
├── /cohorts
├── /private-coaching
└── /retreats
```

Coaching enquiries use the site-wide `/contact` route rather than a separate
`/coaching/contact`, so that one resource is not addressable at two URLs (§37).

The exact product pages may use dynamic routes where appropriate.

---

# 10. Coaching Memberships

```text
/coaching/memberships
```

This page presents the available membership tiers.

The membership model is cumulative:

```text
Silver
   ↓
Gold
   ↓
Platinum
   ↓
Ultimate Membership
```

The page should allow customers to understand the progression and compare benefits.

Individual membership detail pages may use:

```text
/coaching/memberships/[slug]
```

Examples:

```text
/coaching/memberships/silver
/coaching/memberships/gold
/coaching/memberships/platinum
/coaching/memberships/ultimate
```

These routes are examples of the route model; the implementation may instead use a single comparison/product page where that provides a better customer experience.

---

# 11. Membership Offer Structure

The membership benefits are cumulative.

### Silver

- 1 video playlist
- 1 group series (8 sessions)

### Gold

Everything in Silver, plus:

- Additional Gold benefits
- 1 additional group series

Therefore:

- 2 group series total
- 16 sessions total

### Platinum

Everything in Gold, plus:

- All 4 group series
- 32 sessions total
- Virtual retreats
- New courses added during membership

### Ultimate Membership

Everything in Platinum, plus:

- Unlimited cohort access
- New releases
- Masterclasses
- Partner discounts
- Downloadable resources

The route architecture must not hard-code these benefits into the URL structure.

Benefits and entitlements belong to the product/membership system.

---

# 12. Courses

```text
/coaching/courses
```

Public course discovery.

Individual course information:

```text
/coaching/courses/[slug]
```

A public course page should explain:

- What the course is
- Who it is for
- What is included
- Price
- Access/delivery
- Purchase action

Protected course content belongs in the Academy rather than the public product page.

Therefore:

```text
/coaching/courses/[slug]
```

is primarily the commercial/product page.

Whereas:

```text
/academy/courses/[courseSlug]
```

is the authenticated delivery environment.

---

# 13. Group Coaching

```text
/coaching/group-coaching
```

This is the public discovery and commercial area for Group Coaching.

It should explain the available group series.

The four group series are:

- Filmmaking
- Writing
- Producing
- For All Filmmakers

Each series contains 8 sessions.

Therefore:

```text
4 series × 8 sessions = 32 sessions
```

A series may have:

```text
/coaching/group-coaching/[seriesSlug]
```

A particular scheduled session is a booking/delivery concern rather than necessarily a public content route.

---

# 14. Interactive Cohorts

```text
/coaching/cohorts
```

This is the public discovery and commercial area for Interactive Cohorts.

Individual cohort information may use:

```text
/coaching/cohorts/[slug]
```

The existing proposition describes cohort levels including:

- Silver
- Gold
- Platinum
- 8 × 3-hour workshops
- 24 total hours

Cohorts are distinct from Group Coaching.

---

# 15. Private Coaching

```text
/coaching/private-coaching
```

This section presents private/one-to-one coaching services.

A service may use:

```text
/coaching/private-coaching/[slug]
```

Where booking is required, the page should provide the appropriate booking flow.

---

# 16. Retreats

```text
/coaching/retreats
```

The Retreat section presents available virtual or other retreat experiences.

Individual retreat information:

```text
/coaching/retreats/[slug]
```

A retreat may involve:

- Information
- Application
- Selection
- Payment
- Registration
- Booking/attendance

The route structure should not assume every retreat follows the same commercial workflow.

---

# 17. Academy

```text
/academy
```

Academy is the authenticated learning and delivery workspace.

It has its own contextual navigation.

A baseline structure is:

```text
/academy
├── /courses
├── /courses/[courseSlug]
├── /cohorts
├── /cohorts/[cohortSlug]
└── /coaching
```

**Four routes, at the user's direction (2026-09-05) — reversing both R8 and the earlier
Progress addition.** Masterclasses, Calendar, Resources and Progress each had a route at
one point and none now do:

```text
Masterclasses  folds into Courses conceptually (note 07 §22 amended, reversing R8)
Calendar       redundant with /account/bookings, which already lists everything
               booked and its date
Resources      no area of its own — delivered inside whichever course, cohort or
               coaching session it belongs to (note 07 §23's rule for recordings,
               generalised)
Progress       restated what the dashboard and each course's own page already show
               (note 04 §9)
```

Recordings have no route of their own. A recording belongs to its parent — a course, a
cohort workshop or a Group Coaching session — and inherits that parent's access rules
(note 07 §23). It is reached through the parent experience, not through a separate
recordings hierarchy.

Scheduled sessions are not a separate Academy route. A customer's coaching sessions appear
under `/academy/coaching` (§21) and on the dashboard's "Coming up".

The exact Academy routes may evolve as the delivery requirements are implemented.

Protected learning content should not be exposed through the public Coaching routes.

---

# 18. Academy Dashboard

```text
/academy
```

The Academy home/dashboard should show the customer's relevant learning and experiences.

It may include:

- Active courses
- Membership status
- Upcoming sessions
- Cohorts
- Recent activity
- Resources
- Progress
- Relevant bookings

The dashboard should be personalized according to the customer's entitlements.

**Resources and Progress satisfied without a route of their own, 2026-09-05.** Neither
needs a dedicated page to be true: a resource shows inside the course, cohort or coaching
content it belongs to, and progress shows as a per-course summary on this dashboard and in
full on each course's own page (§17, §19). Both were built as standalone Academy routes
the same day and both were removed the same day — the content this bullet list asks for
still exists, just not behind a page whose only content was restating it.

`/academy` itself is publicly accessible and renders differently depending on the visitor:

```text
No session
→ Academy landing page: what the Academy is, plus the sign-in entry point

Session, no entitlements
→ Dashboard with an empty state pointing at /coaching

Session, with entitlements
→ Dashboard showing the customer's entitled areas
```

Every route beneath `/academy` requires a session and the appropriate entitlement. There is
no guest rendering of a course, cohort workspace, resource or recording. See note 01 §8 and
note 05 §16.

---

# 19. Academy Courses

```text
/academy/courses
/academy/courses/[courseSlug]
```

The courses index displays courses the customer can access or has access to.

The individual course route provides the learning environment.

Further nested routes may be introduced if required, for example:

```text
/academy/courses/[courseSlug]/lessons/[lessonSlug]
```

The exact lesson URL structure should be chosen based on the final learning experience.

---

# 20. Academy Cohorts

```text
/academy/cohorts
/academy/cohorts/[cohortSlug]
```

The Academy cohort area provides authenticated cohort content and participation information.

It may include:

- Workshops
- Schedule
- Resources
- Recordings
- Progress
- Attendance
- Relevant communications

Access must be entitlement-based.

---

# 21. Academy Coaching

```text
/academy/coaching
```

This area can show the customer's entitled coaching experiences.

It may include:

- Group series
- Upcoming sessions
- Session history
- Available session credits
- Relevant recordings/resources

The public product information remains under `/coaching`.

---

# 22. Academy Calendar

```text
/academy/calendar
```

The Academy calendar can provide an authenticated view of relevant:

- Coaching sessions
- Cohort workshops
- Events
- Retreat activities
- Other customer-specific scheduled activities

It should show only activities relevant to the authenticated customer.

**Not built as a route, 2026-09-05, at the user's direction.** `/account/bookings` already
lists everything the customer has booked and its date, so a second page answering the same
question was upkeep with no distinct use. Coaching sessions specifically also surface under
`/academy/coaching` (§21) and on the Academy dashboard's "Coming up" (§18).

---

# 23. Academy Resources

```text
/academy/resources
```

Provides authenticated access to resources the customer is entitled to use.

Resources may come from:

- Membership
- Courses
- Cohorts
- Coaching
- Masterclasses
- Other products

**Not built as a route, 2026-09-05, at the user's direction.** Built once as
`/academy/resources` with a real `myResources()` query and a signed-URL download flow
(which also surfaced and fixed a genuine RLS gap — `resources` had no policy letting a
customer read a row they held a direct entitlement to), then removed the same day: a
resource is delivered inside whichever course, cohort or coaching session it belongs to,
never a standalone area — the same rule note 07 §23 already applied to recordings,
generalised to resources of any kind.

---

# 24. Account

```text
/account
```

Account is the global customer account area.

It should use a compact account-focused navigation.

Baseline structure:

```text
/account
├── /profile
├── /security
├── /orders
├── /memberships
├── /entitlements
├── /bookings
├── /billing
├── /notifications
└── /settings
```

`/account/entitlements` is the customer's own view of what they have access to. It shows
each entitlement, the source of that access, remaining quantity where the entitlement is
consumable, start and expiry dates, and renewal information where the access comes from a
membership. It answers the questions note 01 §28 requires a customer to be able to answer
about their own access.

It is read-only and strictly scoped to the signed-in customer. It is not related to
`/admin/entitlements` (§25), which is the staff area for granting, adjusting and revoking
entitlements across all customers.

The exact grouping may be refined during UI design.

---

# 25. Admin

```text
/admin
```

Admin is a private operational workspace with its own prominent navigation.

A baseline structure is:

```text
/admin
├── /users
├── /roles
├── /products
├── /memberships
├── /entitlements
├── /blog
├── /catalogue
├── /courses
├── /group-coaching
├── /cohorts
├── /private-coaching
├── /retreats
├── /events
├── /bookings
├── /orders
├── /payments
├── /emails
└── /settings
```

A dashboard may be:

```text
/admin
```

Additional operational pages can be introduced where required.

Admin routes must be protected by server-side authorization.

---

# 26. Authentication

Use an `/auth` area for authentication-related pages.

Possible routes include:

```text
/auth/sign-in
/auth/sign-up
/auth/2fa
/auth/forgot-password
/auth/reset-password
/auth/verify
/auth/callback
```

Exact routes should follow the current Supabase Auth/Next.js implementation.

`/auth/callback` is a Route Handler rather than a page. It receives the Supabase
authentication callback, completes the session exchange and redirects onward, as defined in
note 05 §11.

The remaining authentication pages should have minimal navigation.

`/auth/2fa` is the second-factor challenge, per note 05 §11.1. It belongs here rather than
in Account because it is a step in signing in, not a setting: it only ever CHALLENGES a key
the account already holds. Registering a key remains `/account/security/mfa`. It requires a
session, carries the destination through as `next`, and is excluded from indexing.

## 26.1 Welcome

```text
/welcome
```

Where `/auth/callback` and the sign-in action send a customer on their **first** successful
sign-in, per note 05 §7.3. It sits outside `/auth/` deliberately: it is not a step in
authenticating, it is the first page of the product.

It requires a session but no entitlement, and it is shown once — `profiles.welcomed_at`
records that it has been. It is safe to reload or revisit, and it is never a dead end: the
destination the customer was originally heading for is carried through and offered as the
onward action.

Excluded from indexing. There is nothing here for a search engine, and every visitor
arriving without a session is redirected away.

It lives inside the `(public)` route group despite requiring a session. The group governs
**layout**, not access (§32): a first-time customer should land in the ordinary site — full
header, full footer, everything reachable — rather than in the stripped-back authentication
chrome they have just left. Access is enforced where it always is, in the page itself and
in the proxy (note 05 §15).

---

# 27. Cart

```text
/cart
```

The cart is the customer's shopping basket.

It may support:

- Product items
- Quantity
- Remove
- Pricing
- Discounts
- Totals
- Continue shopping
- Checkout

The cart should not itself grant access.

Access is created through the order/payment/entitlement workflow.

The cart lives inside the `(public)` route group at `src/app/(public)/cart/`. The URL
remains `/cart`, and the cart inherits the public header and footer from the public layout,
as required by note 04 §19. Checkout, by contrast, uses its own task-focused layout.

---

# 28. Checkout

```text
/checkout
```

Checkout is responsible for taking the customer through the purchase process.

It may support:

- One-time products
- Membership subscriptions
- Applicable discounts
- Customer details
- Stripe Checkout initiation
- Payment status

Successful payment should ultimately result in an order and the appropriate entitlement.

Do not treat a browser redirect alone as proof that payment succeeded.

Payment confirmation must be handled through the appropriate trusted Stripe integration/webhook flow.

Checkout supports both guest and signed-in customers. `/checkout` does not require a
session, and both `/checkout` and its return route must render correctly for a guest.

```text
Signed-in customer
→ order associated with the account at creation

Guest
→ order created against the purchase email, then claimed afterward
```

Stripe Checkout returns the customer to a destination on this site. The checkout result
routes are:

```text
/checkout/success
/checkout/cancel
```

`/checkout/success` reports the current state of the order. It never declares payment
successful on its own — a customer can arrive there before the webhook has finished, so it
must also render a processing state and a failure state, per note 09 §26 and §27. Both
routes must work for a guest.

The secure process for linking a guest purchase to an account is defined in note 05 §29.

---

# 29. Bookings

```text
/bookings
```

Bookings are separate from products and payments.

Possible routes include:

```text
/bookings
/bookings/[bookingId]
/bookings/[bookingId]/cancel
```

The booking system may also have selection flows under the relevant product/service pages.

For example:

```text
/coaching/group-coaching/[seriesSlug]
        ↓
Select eligible session
        ↓
Booking
```

Customers should be able to view relevant bookings through Account and/or Academy where appropriate.

---

# 30. API

HTTP endpoints belong under:

```text
/api
```

Scheduled work also enters through this area. Vercel Cron is the platform's single primary
scheduler (note 01 §18, note 09 §44) and invokes secured Route Handlers:

```text
/api/cron/[job]
```

Each scheduled route is a thin authenticated entry point that verifies the caller and then
invokes the shared operation in `src/lib`. The logic itself is never duplicated into the
route, and no job is implemented a second time as a Supabase Edge Function.

The API area is not the primary way the application's own UI should perform ordinary server mutations.

Use Route Handlers when an actual HTTP endpoint is required.

A key example is:

```text
/api/stripe/webhook
```

Other API endpoints may be introduced for:

- External integrations
- Webhooks
- External clients
- Required HTTP interfaces

Do not create an API endpoint simply because a Server Action or Server Component could perform the operation.

---

# 31. Route-Level Layout Model

The application should use contextual layouts.

Conceptually:

```text
Root Layout
│
├── Public Layout
│   ├── Public Header
│   ├── Public Navigation
│   └── Public Footer
│
├── Academy Layout
│   ├── Academy Navigation
│   └── Academy Content
│
├── Account Layout
│   ├── Account Navigation
│   └── Account Content
│
├── Admin Layout
│   ├── Admin Navigation
│   └── Admin Content
│
└── Task Layouts
    ├── Auth
    ├── Checkout
    └── Booking
```

This keeps each workspace appropriate to its purpose.

---

# 32. Route Groups

Where useful, use Next.js route groups to organize routes without changing their URLs.

For example:

```text
src/app/
├── (public)/
├── academy/
├── account/
├── admin/
├── auth/
├── checkout/
├── bookings/
└── api/
```

`cart/` sits inside `(public)/` rather than at the top level, so that `/cart` receives the
public layout. The URL is unaffected by the route group.

If Coaching is placed inside the public route group:

```text
src/app/(public)/coaching/
```

the URL remains:

```text
/coaching
```

This is the canonical physical location for the public Coaching route unless a later architecture decision changes it.

---

# 33. Route vs UI Responsibility

A route should represent a meaningful URL and page/application boundary.

A UI component should represent reusable presentation or interaction.

Do not create a route for every component.

For example:

```text
/coaching/memberships
```

is a route.

A membership comparison table is a component:

```text
components/coaching/MembershipComparison.tsx
```

Similarly:

```text
/academy/courses/[courseSlug]
```

is a route.

A lesson card is a component.

---

# 34. Public vs Protected Routes

Public routes include most marketing and catalogue pages.

Examples:

```text
/
/about
/about/team
/about/testimonials
/blog
/catalogue
/catalogue/books
/catalogue/films
/catalogue/audio
/catalogue/interviews
/catalogue/stories-from-the-front-line
/catalogue/podcasts
/catalogue/watch
/events
/coaching
/coaching/memberships
/coaching/courses
/coaching/group-coaching
/coaching/cohorts
/coaching/private-coaching
/coaching/retreats
/contact
/privacy
/terms
/cookies
```

Protected routes include customer-specific areas such as:

```text
/academy/...
/account/...
/welcome
```

Admin routes require an additional authorization layer:

```text
/admin/...
```

Authentication is therefore not the same thing as authorization.

A signed-in customer is not automatically an Admin.

A signed-in customer is not automatically entitled to every Academy resource.

---

# 35. Dynamic Routes

Use dynamic routes for resources whose identity comes from data.

Examples:

```text
/blog/[slug]

/events/[slug]

/catalogue/[category]/[slug]

/coaching/courses/[slug]

/coaching/cohorts/[slug]

/coaching/group-coaching/[seriesSlug]

/academy/courses/[courseSlug]

/academy/cohorts/[cohortSlug]

/bookings/[bookingId]

/admin/entitlements/[entitlementId]
```

Dynamic routes should use stable identifiers such as slugs or IDs appropriate to the resource.

Do not hard-code individual product URLs throughout the application.

---

# 36. External Destinations

Some existing catalogue destinations may remain external.

Examples include:

- External podcast platforms
- YouTube
- External websites
- Other services owned or operated separately

When a destination is intentionally external, link to it rather than creating a fake internal route.

The public application should make the distinction clear where appropriate.

---

# 37. URL Principles

URLs should be:

- Stable
- Human-readable
- Predictable
- Meaningful
- Consistent
- Lowercase
- Based on clear resource names

Avoid:

- Random route names
- Wix-generated naming patterns
- Duplicate routes for the same resource
- URLs that expose implementation details
- Unnecessary nesting

The new architecture does not need to preserve old Wix URLs when a better route structure is appropriate, unless SEO/redirect requirements make preservation important.

---

# 38. Redirects and Legacy URLs

If existing public URLs need to remain accessible for SEO, bookmarks or existing customers, implement appropriate redirects from old URLs to the new canonical URLs.

Do not preserve poor URL structures merely because they existed in the previous site.

Legacy URL handling should be addressed during migration/deployment planning.

---

# 39. Route Expansion Principle

The route tree is a baseline, not an immutable list.

Additional routes may be introduced when required by:

- New products
- New content types
- New customer workflows
- New administrative capabilities
- New integrations
- New business requirements

However, every new route should have a clear purpose and should fit the existing information architecture.

Do not create new top-level route groups unnecessarily.

---

# 40. Canonical Route Tree

The baseline application route tree is:

```text
src/app/
│
├── (public)/
│   ├── page.tsx
│   ├── about/
│   │   ├── team/
│   │   └── testimonials/
│   ├── blog/
│   ├── cart/
│   ├── catalogue/
│   │   ├── page.tsx
│   │   ├── books/
│   │   ├── films/
│   │   ├── audio/
│   │   ├── interviews/
│   │   ├── stories-from-the-front-line/
│   │   ├── podcasts/
│   │   └── watch/
│   ├── contact/
│   ├── cookies/
│   ├── events/
│   ├── privacy/
│   ├── terms/
│   ├── welcome/
│   └── coaching/
│       ├── page.tsx
│       ├── about/
│       ├── memberships/
│       ├── courses/
│       ├── group-coaching/
│       ├── cohorts/
│       ├── private-coaching/
│       └── retreats/
│
├── academy/
│   ├── page.tsx
│   ├── courses/
│   ├── cohorts/
│   └── coaching/
│
├── account/
│   ├── page.tsx
│   ├── profile/
│   ├── security/
│   ├── orders/
│   ├── memberships/
│   ├── entitlements/
│   ├── bookings/
│   ├── billing/
│   ├── notifications/
│   └── settings/
│
├── admin/
│   ├── page.tsx
│   ├── users/
│   ├── roles/
│   ├── products/
│   ├── memberships/
│   ├── entitlements/
│   ├── blog/
│   ├── catalogue/
│   ├── courses/
│   ├── group-coaching/
│   ├── cohorts/
│   ├── private-coaching/
│   ├── retreats/
│   ├── events/
│   ├── bookings/
│   ├── orders/
│   ├── payments/
│   ├── emails/
│   └── settings/
│
├── auth/
│   ├── sign-in/
│   ├── sign-up/
│   ├── 2fa/
│   ├── forgot-password/
│   ├── reset-password/
│   ├── verify/
│   └── callback/
│       └── route.ts
│
├── checkout/
│   ├── page.tsx
│   ├── success/
│   └── cancel/
│
├── bookings/
│   ├── page.tsx
│   └── [bookingId]/
│
├── api/
│   ├── stripe/
│   │   └── webhook/
│   │       └── route.ts
│   └── cron/
│       └── [job]/
│           └── route.ts
│
├── layout.tsx
├── not-found.tsx
└── globals.css
```

This route tree is the baseline for subsequent architecture notes.

The exact pages, nested routes and supporting files may be expanded where later requirements justify them, but changes should remain consistent with the principles defined in Architecture Notes 1–3.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-09-04 | §5, §34, §40: About made a **section** rather than a single page — `/about` (Tony's Story), `/about/team` and `/about/testimonials`. The test in §5 was already "only when the content genuinely requires separate destinations"; the reasoning that it is met is now recorded, since the default is one page. Team copy is ~4x the biography and is about other people; testimonials are a data-driven view already reused on the home and coaching pages, so the page is a "see all" destination rather than a second copy. Tony is excluded from the team page by slug so one person is not at two URLs (§37). |
| 2026-08-28 | §7, §8, §34, §35, §40: canonical Catalogue structure recorded — `/catalogue` hub with seven categories (books, films, audio, interviews, stories-from-the-front-line, podcasts, watch), each following the collection/detail model. Individual works such as The Havana Chronicles, Solo2Darwin and Lights, Chutzpah, Action!! are detail pages within a category, not top-level entries; external works remain external links. Closes R9. |
| 2026-08-28 | §25, §40: `/admin/blog` and `/admin/catalogue` added, making Blog and Catalogue first-class managed content domains. Supports R15. |
| 2026-08-28 | §17, §35, §40: `/academy/masterclasses` and `/academy/masterclasses/[masterclassSlug]` added as first-class Academy content with entitlement-based access. Recordings deliberately given no route — they attach to their parent course, cohort workshop, Group Coaching session or masterclass and inherit its access. Closes R8. |
| 2026-08-28 | §24, §40: `/account/entitlements` added as the customer's own read-only view of their access — source, remaining quantity, dates and renewal — kept distinct from the staff area at `/admin/entitlements`. Closes R23. |
| 2026-08-28 | §30, §40: `/api/cron/[job]` added as the Vercel Cron entry point; scheduled routes are thin authenticated wrappers around shared `src/lib` operations. Supports R22. |
| 2026-08-28 | §28, §40: `/checkout/success` and `/checkout/cancel` added as the Stripe Checkout return destinations, per note 09 §26. §28 records that the success route must render paid, processing and failed states and must never declare payment successful on its own (note 09 §27). Closes R6. |
| 2026-08-28 | §25, §35, §40: `/admin/entitlements` and `/admin/entitlements/[entitlementId]` added for reviewing and manually granting, adjusting or revoking customer entitlements, per note 07 §29 and note 06 §23.1. Closes R18. |
| 2026-08-28 | §18: `/academy` recorded as a publicly accessible landing page for guests, with the protected area beginning below it. Closes R14. |
| 2026-08-28 | §28: checkout recorded as supporting both guest and signed-in customers, with the claim process cross-referenced to note 05 §29. Closes R12. |
| 2026-08-28 | §26, §40: `/auth/callback` added as a Route Handler, per note 05 §11. Closes R7. |
| 2026-08-28 | §27, §32, §40: `cart/` moved inside the `(public)` route group so `/cart` inherits the public header and footer. The URL is unchanged. Closes R10. |
| 2026-08-28 | §3, §8.2 (new), §34, §40: public legal routes `/privacy`, `/terms` and `/cookies` added, kept flat rather than grouped under `/legal`. Closes R11. Numbered 8.2 so that no existing section number changes. |
| 2026-08-28 | §3, §8.1 (new), §34, §35, §40: public `/events` and `/events/[slug]` added — events are first-class public offerings needing discovery and registration (note 01 §15). `/admin/events` retained for administration. Closes R3. The new section is numbered 8.1 so that no existing section number changes. |
| 2026-08-28 | §7: `/catalogue/film` corrected to `/catalogue/films`, matching the collection form used in §8. Part of R2. |
| 2026-08-28 | §9: `/coaching/contact` removed from the coaching baseline, reconciling it with the §40 canonical tree; the site-wide `/contact` serves coaching enquiries. Closes R5. |
| 2026-08-28 | §17: `/academy/sessions` removed from the Academy baseline, reconciling it with the §40 canonical tree; sessions surface under `/academy/coaching` and `/academy/calendar`. Closes R4. |
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1), rendering every box-drawing character, arrow, `×` and dash as mojibake (`âââ`, `â`, `Ã`). Those characters were restored to `├── └── │ ↓ × —`. Tree branches were reconstructed with `└──` on each last child. No wording was altered. |
| 2026-09-02 | §26.1 (new), §34, §40: `/welcome` recorded as the first-sign-in destination, per note 05 §7.3. Placed outside `/auth/` because it is the first page of the product rather than a step in authenticating; listed as protected, and excluded from indexing. |
| 2026-09-02 | §7, §35, §40: `/give-get-go` added as a public overview route with `/give-get-go/[section]` covering Publishing, Films and Documentaries, per note 11. The section pages are VIEWS over existing `catalogue_items` — no content is duplicated and no new content entity is introduced. Give-Get-Go Education is an external destination (`give-get-go.com`) and deliberately has no route here. Opens R25: Documentaries has no catalogue category to draw from, so that section renders an explicit empty state rather than a mapping chosen by inference. |
| 2026-09-05 | §26, §40: `/auth/2fa` added as the second-factor challenge, per note 05 §11.1. Placed inside `/auth/` because it is a step in authenticating, unlike `/welcome` (§26.1); enrolment stays in Account. Protected and excluded from indexing. |
