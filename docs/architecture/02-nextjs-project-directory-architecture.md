# Tony Klinger — Next.js Project & Directory Architecture

**File:** `02-nextjs-project-directory-architecture.md`

## 1. Purpose

Define the physical structure of the Tony Klinger Next.js application so that the project remains organized, scalable, maintainable and easy to extend.

The application must use:

* Next.js App Router
* `src/` source-directory convention
* TypeScript
* React
* Supabase
* Stripe
* Brevo

Use the latest stable, production-safe versions of these technologies and their current recommended APIs at the time of implementation.

The directory structure must separate:

* Routes and pages
* Reusable UI components
* Client-side hooks
* Server/business logic
* Database integrations
* Type definitions
* Static assets
* Supabase migrations/functions
* Configuration

Do not place everything inside `app/`.

---

# 2. Project Root

The project should have a structure broadly like:

```text
tonyklinger/
│
├── src/
├── public/
├── supabase/
│
├── .env.local
├── .env.example
├── .gitignore
│
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
│
└── README.md
```

This is the high-level project organization.

Additional configuration files may be introduced when required by the technologies used.

---

# 3. `src/`

`src/` contains the application's source code.

Use `src/` to keep application code separate from:

* Configuration
* Public/static files
* Database migrations
* Deployment files
* Project documentation

The main source directories are:

```text
src/
├── app/
├── components/
├── hooks/
├── lib/
├── types/
└── proxy.ts
```

`proxy.ts` is a file rather than a directory. With the `src/` convention it is a
sibling of `app/`, not a member of it. See §21.1.

Additional source directories may be introduced when there is a clear architectural reason.

Do not create directories merely for the sake of having more directories.

---

# 4. `src/app/`

`app/` contains the Next.js App Router.

It defines the application's URL structure, layouts, pages, loading/error states and HTTP Route Handlers.

Conceptually:

```text
src/app/
├── (public)/
├── academy/
├── account/
├── admin/
├── auth/
├── checkout/
├── bookings/
├── api/
├── layout.tsx
├── not-found.tsx
└── globals.css
```

`cart/` is not a top-level segment. It sits inside `(public)/` so that `/cart` receives the
public header and footer from the public layout — see note 03 §27 and note 04 §19.

The exact routes are defined in the Route & Page Architecture note.

The `app/` directory is therefore primarily concerned with:

* Routing
* Page composition
* Layouts
* Server Components
* Route-level loading/error states
* Route Handlers
* Route-specific Server Actions where appropriate

It should not become a dumping ground for every type of application code.

---

# 5. Route Groups

Use Next.js route groups where they improve organization without changing the URL.

For example:

```text
src/app/
└── (public)/
    ├── about/
    ├── blog/
    ├── cart/
    ├── catalogue/
    ├── contact/
    ├── cookies/
    ├── events/
    ├── privacy/
    ├── terms/
    └── coaching/
```

Catalogue content — books, films, media, interviews and the rest — sits beneath
`catalogue/` rather than at the top level. The canonical public URLs are therefore
`/catalogue/books`, `/catalogue/films` and so on, as defined in note 03 §7–§8.

The `(public)` directory is a route group.

It does NOT become part of the URL.

Therefore:

```text
src/app/(public)/about/page.tsx
```

produces:

```text
/about
```

Route groups should be used to organize related routes and layouts, not simply because they are available.

---

# 6. `page.tsx`

A `page.tsx` file defines a route's UI.

Example:

```text
src/app/(public)/coaching/page.tsx
```

creates:

```text
/coaching
```

A page may be a Server Component by default.

It can:

* Retrieve server-side data
* Compose components
* Render the page
* Pass data to Client Components

Do not automatically make every page a Client Component.

Use `"use client"` only when client-side functionality is actually required.

---

# 7. `layout.tsx`

Layouts define shared UI around routes.

Examples include:

```text
src/app/layout.tsx
```

for the root application layout.

Additional layouts may be used for areas such as:

```text
src/app/academy/layout.tsx
src/app/admin/layout.tsx
src/app/account/layout.tsx
```

This allows each major workspace to have its own structure.

For example:

```text
Public layout
→ Public navigation + footer

Academy layout
→ Academy navigation + Academy content

Admin layout
→ Admin navigation + Admin content

Account layout
→ Account-focused navigation + Account content
```

The root layout should contain only genuinely global application concerns.

---

# 8. `loading.tsx`

Use `loading.tsx` for route-level loading UI where appropriate.

Example:

```text
src/app/academy/loading.tsx
```

This provides an appropriate loading experience while the Academy route is being rendered.

Loading states should be designed intentionally rather than leaving users with a blank screen.

---

# 9. `error.tsx`

Use route-level error boundaries where appropriate.

Example:

```text
src/app/academy/error.tsx
```

Errors should provide:

* Clear feedback
* A useful recovery option
* Appropriate logging/diagnostics where required

Do not expose sensitive server or database information to users.

---

# 10. `not-found.tsx`

Use `not-found.tsx` for appropriate missing-resource or missing-route experiences.

The application should have a coherent global 404 experience and may have specialized not-found handling where useful.

---

# 11. `src/components/`

`components/` contains reusable React UI components.

These are components that can be shared across routes.

Suggested organization:

```text
src/components/
├── ui/
├── layout/
├── navigation/
├── forms/
├── content/
├── academy/
├── coaching/
├── account/
└── admin/
```

`layout/` holds the reusable layout primitives defined in note 10 §11 — page and content
containers, sections, grids, stacks — so that pages do not each invent their own content
width. `content/` holds the presentation components for the content-heavy public material
described in note 10 §42.

Examples:

```text
components/ui/Button.tsx
components/ui/Modal.tsx
components/ui/Input.tsx

components/navigation/MainNav.tsx
components/navigation/MobileNav.tsx

components/academy/CourseCard.tsx
components/academy/LessonPlayer.tsx

components/coaching/ProductCard.tsx
components/coaching/BookingSelector.tsx
```

Components should be organized by responsibility and reuse.

Do not put server business logic into presentation components.

---

# 12. `components/ui/`

This contains generic reusable interface components.

Examples:

* Button
* Input
* Select
* Dialog
* Modal
* Tabs
* Badge
* Card
* Dropdown
* Tooltip
* Accordion
* Pagination
* Toast

These components should generally have no knowledge of Tony-specific business rules.

For example:

```text
Button
```

should not know what a "Platinum Membership" is.

A higher-level component can use the generic Button.

---

# 13. `components/navigation/`

Contains navigation-related components.

Examples:

```text
MainNavigation
MobileNavigation
AcademyNavigation
AdminNavigation
AccountMenu
UserMenu
Breadcrumbs
```

Different application areas should use appropriate navigation.

The public site should not be forced to use the Academy navigation.

Admin should not use the public site's full navigation.

---

# 14. Feature Components

Feature-specific components belong in appropriate feature directories.

Examples:

```text
components/coaching/
components/academy/
components/account/
components/admin/
```

A component that is genuinely specific to a particular feature should not be placed in `components/ui/`.

For example:

```text
components/coaching/MembershipComparison.tsx
```

is more appropriate than placing it in:

```text
components/ui/
```

because it contains Tony-specific business presentation.

---

# 15. `src/hooks/`

`hooks/` contains reusable React hooks.

Hooks are primarily used for client-side React behavior.

Examples:

```text
src/hooks/
├── useUser.ts
├── useMembership.ts
├── useCourse.ts
├── useBooking.ts
└── useMediaQuery.ts
```

Hooks may manage:

* Client-side state
* Client-side effects
* Browser APIs
* Client-side subscriptions
* Reusable client-side behavior

A hook does NOT automatically mean that the data itself must come from a client-only source.

A client hook can obtain data through:

* Supabase client
* An API endpoint
* A Server Action
* Another client-accessible data mechanism

However, server-side data retrieval required for initial page rendering should generally be handled through Server Components or appropriate server-side mechanisms rather than unnecessarily moving everything into hooks.

---

# 16. `src/lib/`

`lib/` contains reusable application and integration logic that is not itself a React component.

Examples:

```text
src/lib/
├── supabase/
├── stripe/
├── brevo/
├── permissions/
├── validation/
└── utils/
```

This is where reusable backend/application logic can live.

Examples:

* Database helpers
* Stripe helpers
* Email helpers
* Authorization helpers
* Validation
* Business calculations
* Utility functions

`lib/` should not become a miscellaneous dumping ground.

Organize it according to meaningful responsibilities.

---

# 17. `src/lib/supabase/`

Supabase-specific clients and helpers belong here.

For example:

```text
src/lib/supabase/
├── client.ts
├── server.ts
└── admin.ts
```

### `client.ts`

Creates/configures the Supabase client intended for browser/client-side use.

It is used when code running in the browser needs to communicate with Supabase according to the application's security model.

### `server.ts`

Creates/configures the Supabase client intended for server-side use.

It is used by:

* Server Components
* Server Actions
* Server-side application code

It can work with the user's authenticated server-side session.

### `admin.ts`

Used only for trusted server-side administrative operations where elevated Supabase privileges are genuinely required.

It must never expose a service-role secret to the browser.

---

# 18. Server Components vs `lib`

A Server Component is a React component concerned with rendering UI.

`lib/` is reusable application logic.

For example:

```text
Server Component
      ↓
lib/courses/getCourse.ts
      ↓
Supabase server client
      ↓
Database
```

The Server Component renders the result.

The library function performs reusable application logic.

Do not confuse "runs on the server" with "is a Server Component".

---

# 19. Server Actions

Server Actions are server-side functions that can be invoked from appropriate application UI flows.

They are not components.

They should generally live close to the feature that uses them.

Example:

```text
src/app/account/profile/actions.ts
src/app/(public)/coaching/courses/actions.ts
src/app/academy/courses/actions.ts
```

Use Server Actions for UI-initiated server operations such as appropriate mutations.

Do not create a single enormous global `actions.ts` file containing unrelated application operations.

Where an operation is shared across several areas, reusable business logic should be extracted into `lib/`, while the Server Action remains responsible for the action boundary.

---

# 20. Route Handlers

HTTP endpoints use:

```text
route.ts
```

Example:

```text
src/app/api/stripe/webhook/route.ts
```

Route Handlers are appropriate when something needs an HTTP endpoint.

Typical uses include:

* Stripe webhooks
* External callbacks
* API endpoints
* HTTP integrations

A Route Handler is not simply another way of writing a Server Component.

It responds to HTTP requests.

---

# 21. Server Actions vs Route Handlers

Use a simple architectural rule:

```text
Own UI triggers server operation
        ↓
Server Action

External system sends HTTP request
        ↓
Route Handler / HTTP endpoint
```

Example:

```text
Customer clicks "Update Profile"
        ↓
Server Action
```

Whereas:

```text
Stripe
   ↓
POST /api/stripe/webhook
   ↓
route.ts
```

The exact choice should always follow the purpose of the operation.

---

# 21.1 Proxy (formerly Middleware)

```text
src/proxy.ts
```

**Verified against Next.js 16.3.3 on 2026-08-28.** Next.js renamed the `middleware`
convention to `proxy` in version 16 to clarify that it is a network/routing boundary. The
file is `proxy.ts`, it exports a `proxy` function (named or default) plus an optional
`config.matcher`, and its runtime is Node and is not configurable — the `edge` runtime is
not supported in `proxy`. There is exactly one such file per application.

This is the "current stable Next.js equivalent" that this section was written to allow.

The application requires this layer for authentication/session handling and route
protection, as defined in note 05 §15.

With the `src/` source-directory convention this file is a sibling of `app/`, not a member
of it, and there is exactly one of them for the whole application.

Its responsibilities are:

- Refreshing the Supabase authentication session so server-rendered requests see a valid session
- Coarse protection of route areas that require a session
- Redirecting unauthenticated requests to sign-in, preserving the intended destination
- Nothing else

It is a request-level gate, not the security model. Per note 05 §15, route protection at
this layer never replaces server-side authorization or Supabase RLS. A request that
middleware allows through must still be authorized by the Server Component, Server Action
or Route Handler that serves it, and the database must still enforce ownership.

Keep it thin. Business logic, data access and entitlement checks do not belong here — it
runs on every matched request, and its matcher should exclude static assets and public
routes.

Next.js's own documentation states that this layer is for optimistic checks and is "not
intended ... as a full session management or authorization solution", which is the same
constraint this architecture places on it.

Per §31 and note 05 §39, re-verify the convention and the current recommended Supabase SSR
integration whenever the framework is upgraded, rather than copying an older middleware
pattern from a tutorial.

---

# 22. `src/types/`

Contains shared TypeScript types.

Suggested structure:

```text
src/types/
├── database.ts
├── products.ts
├── orders.ts
├── academy.ts
├── memberships.ts
├── bookings.ts
└── ...
```

Types should represent important application concepts.

Examples:

* Product
* Price
* Order
* Membership
* Course
* Booking
* Entitlement
* User profile

Database-generated types may be generated from the Supabase schema where appropriate.

Do not duplicate the same type definition unnecessarily in multiple files.

---

# 23. `public/`

`public/` contains static assets that need to be served directly.

Example:

```text
public/
├── images/
├── icons/
├── logos/
└── ...
```

Use it for appropriate static assets such as:

* Logos
* Icons
* Static images
* Favicons
* Public downloadable assets

Do not put secrets or private user files in `public/`.

User/private assets should use an appropriate protected storage mechanism such as Supabase Storage with proper access controls.

The dividing line, in practice:

```text
public/            Static design assets — logo, icons, decorative art, favicons.
                   Shipped with the build; changed only by a deploy.
Supabase Storage   Dynamic assets an administrator adds or replaces without a
                   deploy — imagery, public audio, worksheets, documents
                   (note 08 §60.1).
Livid              All video (note 09 §40.1).
```

Assets served from `public/` are CDN-cached but are **not** compressed or resized.
Only `next/image` re-encodes to AVIF/WebP and serves the size the layout asks for, for
both local and remote assets; a remote host must be allowlisted before it will. Gated
assets are never passed through it, because that would cache entitlement-gated content
on a public CDN (note 08 §60.2).

---

# 24. `supabase/`

The `supabase/` directory contains database/backend infrastructure that belongs to the Supabase project.

Suggested structure:

```text
supabase/
├── migrations/
├── functions/
├── content/        real site content — production initial setup (`pnpm content:setup`)
├── seed.sql        local-only fixtures: test accounts, placeholders
└── config.toml
```

This directory is separate from `src/` because it is not normal Next.js application source code.

---

# 25. `supabase/migrations/`

Database schema changes should be represented as SQL migrations.

Examples include:

* Tables
* Columns
* Relationships
* Indexes
* Constraints
* RLS
* Policies
* Database functions
* Triggers

Use standard PostgreSQL SQL supported by Supabase.

Migrations should be committed to GitHub.

Do not rely on manually creating the production schema only through the Supabase Dashboard.

---

# 26. `supabase/functions/`

Contains Supabase Edge Functions where they are appropriate.

Example:

```text
supabase/functions/
├── ...
```

Per note 01 §17 and note 09 §44, this directory is expected to stay largely empty. Background
processing runs in the Next.js/Vercel server layer, scheduled by Vercel Cron through secured
Route Handlers under `src/app/api/cron/`. Add an Edge Function only where a requirement is
genuinely database-specific and cannot reasonably be served from the Next.js server layer.

Use Edge Functions when backend processing is appropriately hosted within the Supabase environment.

Possible uses include:

* Backend processing
* Scheduled/background operations
* Supabase-oriented integrations

Do not automatically place every server-side operation here.

Next.js Server Actions and Route Handlers remain appropriate for many application operations.

---

# 27. Database Triggers

Some automatic database behaviour belongs directly in PostgreSQL/Supabase rather than in React or Next.js.

Examples:

```text
User-related database change
        ↓
PostgreSQL trigger
        ↓
Required database cleanup
```

Appropriate examples may include:

* Maintaining related records
* Automatic timestamps
* Data integrity
* Certain deletion/cascade behaviours

Use database constraints and triggers where the behaviour fundamentally belongs at the database level.

---

# 28. Background and Scheduled Processes

Processes that are not initiated directly by the UI must have an appropriate server-side location.

Examples:

* Subscription reconciliation
* Expired entitlement cleanup
* Booking cleanup
* Email-list synchronization
* Scheduled maintenance
* Notification processing

Depending on the requirement, these may use:

```text
Scheduled job
      ↓
Supabase Edge Function
```

or:

```text
Scheduled job
      ↓
Next.js HTTP endpoint
```

or:

```text
Database event
      ↓
PostgreSQL trigger
```

Reusable processing logic should live in an appropriate `lib/` module where possible.

---

# 29. Configuration Files

Project configuration belongs at the project root unless a tool requires another location.

Examples:

```text
next.config.ts
tsconfig.json
package.json
eslint.config.mjs
postcss.config.mjs
```

Configuration should be kept clear and minimal.

Do not add configuration files unless the project actually needs them.

---

# 30. Environment Variables

Use environment variables for secrets and environment-specific configuration.

Example:

```text
.env.local
.env.example
```

`.env.example` should document the names of required variables without containing real secrets.

Never commit:

* Supabase service-role keys
* Stripe secret keys
* Brevo API keys
* Other private credentials

Server-only secrets must remain server-side.

---

# 31. Dependency and Version Management

Use the latest stable, production-safe versions of project dependencies at the time the application is implemented.

This applies to:

* Next.js
* React
* TypeScript
* Supabase packages
* Stripe packages
* Brevo integrations
* Tailwind CSS
* ESLint
* Other dependencies

Use current recommended APIs.

Avoid:

* Deprecated APIs
* Unnecessary legacy patterns
* Old package versions copied from unrelated examples
* Experimental features without a clear production reason

Package versions should be recorded in the project's package manager lockfile.

---

# 32. Directory Responsibility Rules

Use the following rules as the basic architectural guide:

```text
app/
→ Routes, pages, layouts, Server Components, Route Handlers

components/
→ Reusable UI

hooks/
→ Reusable client-side React behavior

lib/
→ Reusable application/integration/business logic

types/
→ Shared TypeScript types

public/
→ Public static assets

supabase/migrations/
→ Database schema and database-level changes

supabase/functions/
→ Appropriate Supabase backend functions
```

Do not move code into another directory merely because it happens to work there.

Place code according to its responsibility.

---

# 33. Avoid Over-Engineering

The directory structure should remain understandable.

Do not create:

* A directory for every tiny function
* Duplicate service layers
* Unnecessary abstractions
* Multiple competing data-access patterns
* Global files containing unrelated business logic

Introduce additional architectural layers only when they solve a real problem.

---

# 34. Feature Locality

When functionality is strongly tied to a particular route or feature, keep the implementation close to that feature.

For example:

```text
src/app/(public)/coaching/courses/
├── page.tsx
├── actions.ts
└── ...
```

This makes the feature easier to understand and maintain.

Reusable functionality can then be promoted into:

```text
src/components/
src/hooks/
src/lib/
src/types/
```

when it genuinely becomes shared.

---

# 35. Overall Directory Model

The resulting project should conceptually follow:

```text
tonyklinger/
│
├── src/
│   │
│   ├── app/
│   │   ├── (public)/
│   │   ├── academy/
│   │   ├── account/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── checkout/
│   │   ├── bookings/
│   │   ├── api/
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── navigation/
│   │   ├── forms/
│   │   ├── content/
│   │   ├── academy/
│   │   ├── coaching/
│   │   ├── account/
│   │   └── admin/
│   │
│   ├── hooks/
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   ├── stripe/
│   │   ├── brevo/
│   │   ├── permissions/
│   │   ├── validation/
│   │   └── utils/
│   │
│   ├── types/
│   │
│   └── middleware.ts
│
├── public/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   ├── content/
│   ├── seed.sql
│   └── config.toml
│
├── .env.local
├── .env.example
├── package.json
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
└── README.md
```

This is the **baseline directory architecture**, not a restriction that prevents additional directories or files from being introduced when future requirements justify them.

---

# 36. Architectural Principle

The most important rule is:

**Organize code by responsibility and feature, not merely by file type.**

The application should make it immediately understandable:

* Where a route lives
* Where reusable UI lives
* Where client hooks live
* Where server/business logic lives
* Where integrations live
* Where types live
* Where database schema lives
* Where background processing lives

The structure should remain easy for both developers and AI coding tools to understand and maintain.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-08-28 | Initial version recorded as supplied. |
| 2026-08-28 | §19 and §34: coaching example paths corrected to `src/app/(public)/coaching/...` so they match the `(public)` route-group placement stated in §5 and §35. Closes reconciliation item R1. |
| 2026-08-28 | §26: recorded that background processing runs in the Next.js/Vercel layer scheduled by Vercel Cron, so `supabase/functions/` stays largely empty and Edge Functions are reserved for genuinely database-specific work. Supports R22. |
| 2026-08-28 | §3, §21.1, §35: `src/middleware.ts` renamed to `src/proxy.ts`. Verified against Next.js 16.3.3 during implementation — Next 16 renamed the `middleware` convention to `proxy`, the runtime is Node and not configurable, and the `edge` runtime is unsupported there. §21.1 retitled and its verification caveat updated. This is the substitution the section's "or the current stable equivalent" wording anticipated. |
| 2026-08-28 | §11, §35: `layout/` and `content/` added to the component groupings, and `forms/` added to the §35 tree to match §11, per note 10 §17. |
| 2026-08-28 | §3, §21.1 (new), §35: `src/middleware.ts` added for authentication/session handling and route protection, per note 05 §15. Closes R13. Numbered 21.1 so that no existing section number changes. |
| 2026-08-28 | §4, §5, §35: `cart/` moved inside `(public)/` so `/cart` inherits the public layout (closes R10). Legal routes `privacy/`, `terms/`, `cookies/` added to the `(public)` example tree (closes R11). |
| 2026-08-28 | §5: the `(public)` example tree replaced. `books/`, `films/` and `media/` removed as top-level routes — catalogue content is nested under `catalogue/` per note 03 §7–§8 (closes R2). `blog/` and `contact/` added to match note 03 §3; `events/` retained as a public route (closes R3). |
| 2026-09-03 | §23: public audio added to the Supabase Storage side of the asset boundary, per the R26 closure in note 08 §60.1. Audio is not video and does not go to Livid; gated audio follows the private-bucket path. |
| 2026-09-02 | §23: the boundary between `public/`, Supabase Storage and Livid recorded explicitly, with the note that `public/` assets are CDN-cached but never compressed or resized — only `next/image` does that, and gated assets are excluded from it. |
