# Tony Klinger — Navigation & Layout Architecture

**File:** `04-navigation-and-layout-architecture.md`

## 1. Purpose

Define how navigation and shared layouts work across the Tony Klinger application.

The application has several distinct experiences:

- Public website
- Coaching storefront
- Academy
- Customer Account
- Administration
- Authentication
- Cart/Checkout
- Booking flows

Each should use navigation appropriate to its purpose rather than forcing one menu across the entire application.

This note defines navigation and layout behaviour, not the detailed page content or database schema.

---

## 2. Core Navigation Principle

Use **contextual navigation**.

The navigation shown to a user should reflect the area of the application they are currently using.

```text
PUBLIC
→ Public Tony Klinger navigation

ACADEMY
→ Academy navigation

ACCOUNT
→ Account navigation

ADMIN
→ Admin navigation

AUTH / CHECKOUT
→ Minimal task-focused navigation
```

The application should not display the entire site's navigation inside every workspace.

---

## 3. Public Site Navigation

The public navigation represents the main Tony Klinger brand and public destinations.

The baseline primary menu is:

```text
Home
Coaching
About
Blog
Catalogue
Contact
```

The navigation should also provide an appropriate account/sign-in entry point.

The public menu should remain focused on the principal destinations rather than listing every page.

---

## 4. Public Menu Structure

A baseline structure is:

```text
Home
Coaching
About
Blog
Catalogue
Contact
```

### Coaching

Coaching is a major commercial section and may expose appropriate secondary navigation.

Conceptually:

```text
Coaching
├── About
├── Memberships
├── Courses
├── Group Coaching
├── Cohorts
├── Private Coaching
└── Retreats
```

### About

About is a section rather than a single destination (note 03 §5):

```text
About
├── Tony's Story
├── Meet the Team
└── Testimonials
```

The team copy is roughly four times the length of the biography and concerns
other people, and the testimonials are a reusable data-driven view already
surfaced on the home and coaching pages — neither reads well inlined in a
biography.

### Catalogue

Catalogue is the public discovery area for Tony's work and media.

Conceptually:

```text
Catalogue
├── Books
├── Films
├── Audio
├── Interviews
├── Stories From The Front Line
├── Podcasts
└── Watch
```

The menu shows the seven Catalogue categories defined in note 03 §7.

Individual works — The Havana Chronicles, Solo2Darwin, Lights, Chutzpah, Action!!, the
individual podcasts — are detail pages inside the relevant category, reached from that
category's page. They are not menu items, and the old Wix menu is not reproduced as
navigation.

Some catalogue destinations may be external links.

The visible menu structure should remain understandable rather than becoming an excessively deep mega-menu.

---

## 5. Catalogue URL Structure

The canonical public URL structure places catalogue content under:

```text
/catalogue/...
```

Examples:

```text
/catalogue/books
/catalogue/films
/catalogue/media
/catalogue/audio
/catalogue/interviews
```

This does not require the visible navigation to display the word "Catalogue" as part of every menu label.

The menu can simply display:

```text
Catalogue
```

with its relevant children.

---

## 6. Public Events

Events are first-class public offerings.

Use:

```text
/events
```

for public event discovery.

Where appropriate:

```text
/events/[slug]
```

can display an individual event.

The public event experience may include:

- Event information
- Date/time
- Venue or delivery information
- Capacity
- Price
- Registration
- Booking
- Payment where required

Events may be included in the public navigation if the final content volume and business priorities justify it.

The existence of `/events` does not require Events to become a permanent top-level menu item.

---

## 7. Public Header

The public header should contain:

- Tony Klinger branding/logo
- Main public navigation
- Account/sign-in entry
- Appropriate cart entry where shopping is relevant
- Mobile navigation control

The header should remain visually clear and responsive.

Do not overcrowd the header with every available destination.

---

## 8. Public Footer

The public footer should provide secondary navigation and useful information.

It may contain:

- Important public links
- Contact information
- Social links
- Legal pages
- Privacy
- Terms
- Cookie information
- Newsletter/email signup where appropriate
- External destinations

The legal pages have defined routes (note 03 §8.2):

```text
/privacy
/terms
/cookies
```

The footer should not duplicate the entire primary navigation unnecessarily.

---

# 9. Academy Navigation

The Academy is a substantial authenticated workspace and should therefore have its own **prominent Academy navigation**.

The Academy navigation should not simply reuse the public website menu.

Baseline Academy navigation:

```text
Academy
├── Dashboard
├── Courses
├── Cohorts
└── Coaching
```

**Four items, at the user's direction (2026-09-05), reversing a seven-item baseline built up
over two rounds the same day:**

- **Progress** duplicated what already exists elsewhere: the dashboard shows progress across
  every enrolled course, and each course's own page shows its progress in full — lessons
  completed, and a "Resume" link to the first unfinished one. `progressAcrossCourses()`
  (`src/lib/academy`) is unchanged; only the route that existed solely to render it on its
  own is gone.
- **Masterclasses** reverses R8 (closed 2026-08-28, note 07 §22): a masterclass is the same
  kind of thing as a course wearing a different label and does not earn a parallel
  destination.
- **Calendar** restated `/account/bookings`, which already lists everything booked and its
  date.
- **Resources** gets no area of its own — a resource is delivered inside whichever course,
  cohort or coaching session it belongs to, generalising the rule note 07 §23 already gives
  recordings.

Recordings are deliberately not a navigation destination. A recording is reached through its
parent — the course, cohort workshop or Group Coaching session it belongs to — and inherits
that parent's access (note 07 §23).

Additional items may be displayed when relevant to the user's entitlements.

For example:

- Membership
- Upcoming sessions

However, the navigation should remain useful and not display inaccessible features as though the user owns them.

A guest viewing the public `/academy` landing page (note 03 §18) does not receive the
Academy workspace navigation. The landing page uses the public layout and offers a sign-in
entry point; the Academy navigation appears once the visitor is authenticated.

---

## 10. Academy Header

The Academy header should clearly identify the user as being inside the Academy.

It should provide:

- Tony Klinger/Academy branding
- Academy navigation
- User/account menu
- Appropriate notifications
- Mobile navigation
- Link back to the public Tony Klinger website

The Academy should feel like a distinct workspace while remaining part of the same application.

---

## 11. Academy Sidebar / Responsive Navigation

A desktop Academy interface may use a prominent sidebar or similarly prominent navigation.

On smaller screens it should become a mobile-friendly navigation system.

The navigation must:

- Remain accessible
- Be easy to open/close
- Clearly show the current location
- Support nested items where necessary
- Avoid clipping
- Work with touch interaction

Do not simply shrink a desktop navigation until it becomes unusable.

---

# 12. Account Navigation

The Account area is global rather than Academy-specific.

Use a compact account-focused menu.

Baseline:

```text
Account
├── Overview
├── Profile
├── Orders
├── Memberships
├── Entitlements
├── Bookings
├── Billing
├── Security
├── Notifications
└── Settings
```

Entitlements is the customer's own read-only view of their access (note 03 §24). It is
unrelated to the Admin entitlement-management area.

The exact grouping may be simplified where several items naturally belong together.

Account should not use the large Academy navigation or Admin navigation.

---

# 13. Account Header

The Account interface should clearly identify the customer's account context.

It should provide:

- Tony Klinger branding
- Account title/context
- Compact account navigation
- Link to Academy where relevant
- Link back to the public site
- User menu/sign-out

The interface should remain focused rather than becoming another large workspace.

---

# 14. Admin Navigation

Admin is a substantial operational workspace and should have its own prominent navigation.

Baseline:

```text
Admin
├── Dashboard
├── Users
├── Roles
├── Products
├── Memberships
├── Entitlements
├── Blog
├── Catalogue
├── Courses
├── Group Coaching
├── Cohorts
├── Private Coaching
├── Retreats
├── Events
├── Bookings
├── Orders
├── Payments
├── Emails
└── Settings
```

Additional administration areas may be introduced when required.

Admin navigation should support clear grouping as the system grows.

---

## 15. Admin Navigation Groups

If the number of Admin destinations becomes large, organize them into logical groups.

For example:

```text
Overview
  Dashboard

Customers
  Users
  Roles

Commerce
  Products
  Memberships
  Entitlements
  Orders
  Payments

Content
  Blog
  Catalogue

Learning
  Courses
  Cohorts
  Group Coaching
  Masterclasses

Experiences
  Private Coaching
  Retreats
  Events
  Bookings

Communications
  Emails

System
  Settings
```

This is a navigation organization model, not a requirement that every group must initially be visible as a separate menu heading.

---

# 16. Admin Header

The Admin header should clearly indicate that the user is in the administrative workspace.

It should provide:

- Tony Klinger branding
- Admin/workspace identification
- User/admin menu
- Notifications where required
- Mobile navigation
- Appropriate link back to the public website

Do not make the Admin interface visually indistinguishable from the public site.

---

# 17. Authentication Navigation

Authentication pages should use minimal navigation.

Examples:

```text
/auth/sign-in
/auth/sign-up
/auth/forgot-password
/auth/reset-password
```

The user should be focused on authentication rather than browsing the full website.

A logo/brand link back to the public site is appropriate.

Do not expose the full public menu unnecessarily on authentication pages.

---

# 18. Checkout Navigation

Checkout should also use a minimal, task-focused layout.

The customer is completing a transaction.

Avoid unnecessary navigation that could distract from checkout.

The checkout experience may include:

- Branding
- Cart/order summary
- Checkout status
- Security/trust information
- Required support/contact information

The customer should still have an appropriate way to recover from an error or return to shopping.

---

# 19. Cart Navigation

The Cart can remain within the public/commercial experience but should emphasize shopping actions.

Possible structure:

```text
Public Header
    ↓
Cart
    ↓
Continue Shopping / Checkout
```

The cart receives the public header and footer because `cart/` sits inside the `(public)`
route group (note 03 §27, §32). The URL remains `/cart`.

The cart should not require the full Academy or Account navigation.

---

# 20. Booking Navigation

Booking is task-focused.

When a customer is selecting a date/time for an eligible service, the interface should prioritize:

```text
Service
   ↓
Eligibility
   ↓
Availability
   ↓
Date/Time
   ↓
Confirmation
```

Avoid unnecessary global navigation during the core booking flow.

After completion, provide clear routes to:

- Booking details
- Account
- Academy where relevant
- Public site

---

# 21. Logo and Return Navigation

The Tony Klinger brand/logo should provide a clear route back to the main public website when appropriate.

For example:

```text
Academy
   ↓
Tony Klinger logo
   ↓
/
```

Similarly:

```text
Admin
   ↓
Tony Klinger logo
   ↓
/
```

However, the logo should not replace explicit navigation where a user needs a clear route to a specific workspace.

The user should not have to rely solely on the browser Back button.

---

# 22. User Menu

Authenticated users should have a consistent user/account menu.

It may provide:

```text
My Account
Academy
Orders
Bookings
Settings
Sign Out
```

The exact items should be context-sensitive.

For example, an Admin user may also see:

```text
Admin
```

The menu should not expose destinations the user is unauthorized to access.

---

# 23. Navigation and Authorization

Navigation visibility is not authorization.

For example:

```text
Admin link hidden
≠
Admin access denied
```

The route itself must enforce authorization.

Similarly:

```text
Course link hidden
≠
Course protected
```

Academy resources must enforce authentication and entitlement checks independently of navigation.

---

# 24. Active Navigation State

The current route should be visually identifiable.

Examples:

```text
Catalogue   ← active
```

or:

```text
Academy
  Courses   ← active
```

Active states should work for nested routes.

For example:

```text
/academy/courses/my-course
```

should still make it clear that the user is inside Academy → Courses.

**Visual highlighting and `aria-current` are not the same thing.** Being *inside*
a section and being *on* its page are different facts, and the interface should
show the first while announcing only the second:

```text
Visual highlight   PREFIX match. /about/team highlights About — that is §24.
aria-current="page" EXACT match. It identifies ONE element: the page you are on.
aria-current="true" A section trigger that contains the current page, at most.
```

Using prefix matching for `aria-current="page"` marks every ancestor as current,
so a screen reader announces two or three different links as "current page" on
one route. A submenu **trigger** is a `<button>` that opens a menu, not a
destination, and never takes `"page"` at all.

**A dropdown must contain a link to its own landing page.** Because the trigger
is a button, it cannot navigate: without an explicit entry, the section's landing
page is unreachable from the desktop navigation entirely, which §21 forbids.

---

# 25. Nested Navigation

Use nested navigation only where it improves usability.

Examples:

```text
Catalogue
  ├── Books
  ├── Films
  └── Audio
```

and:

```text
Academy
  ├── Courses
  ├── Cohorts
  └── Coaching
```

Avoid deeply nested navigation structures.

If a section becomes too large, use a landing page with contextual navigation instead of creating an enormous menu.

---

# 26. Desktop Navigation

Desktop navigation should:

- Be clearly visible
- Fit within the available viewport
- Maintain readable spacing
- Avoid clipping
- Provide clear hierarchy
- Support dropdowns where appropriate
- Remain accessible by keyboard

The public navigation should not become so large that the header dominates the page.

Academy and Admin may use larger workspace navigation because their purposes are different.

---

# 27. Mobile Navigation

Mobile navigation should use a clear menu control.

When opened it should provide access to the relevant navigation items.

The mobile menu should:

- Be easy to open
- Be easy to close
- Have adequate touch targets
- Preserve hierarchy
- Support nested sections
- Avoid horizontal clipping
- Clearly show the active location

Do not hide important navigation simply because the viewport is narrow.

---

# 28. Layout Boundaries

The application should use route-level layouts to enforce workspace boundaries.

Conceptually:

```text
src/app/layout.tsx
        │
        ├── Public layout
        │
        ├── Academy layout
        │
        ├── Account layout
        │
        ├── Admin layout
        │
        └── Task-focused layouts
            ├── Auth
            ├── Checkout
            └── Booking
```

Each layout should provide only the shared structure appropriate to its workspace.

---

# 29. Public Layout

The public layout should generally contain:

```text
Public Header
    ↓
Public Navigation
    ↓
Page Content
    ↓
Public Footer
```

It should be applied to the public routes.

The public layout should not wrap Admin or Academy with the public footer/header unless deliberately required.

---

# 30. Academy Layout

The Academy layout should generally contain:

```text
Academy Header
    ↓
Academy Navigation
    ↓
Academy Content
```

It should support the learning workspace without unnecessarily displaying public-site content.

---

# 31. Account Layout

The Account layout should generally contain:

```text
Account Header
    ↓
Account Navigation
    ↓
Account Content
```

The navigation should remain compact.

---

# 32. Admin Layout

The Admin layout should generally contain:

```text
Admin Header
    ↓
Admin Navigation
    ↓
Admin Content
```

Admin should be visually and structurally recognizable as an operational workspace.

## 32.1 Deep links must survive the gate

A layout cannot see the URL it is rendering, so the Admin layout's second-factor gate could
only ever name `/admin` as the place to return to — and every deep link followed while
signed in at `aal1` collapsed to the dashboard after the challenge.

The proxy stamps the requested path on the request headers (`x-pathname`), which it already
rebuilds on every request, and the layout uses it as the return target. It is our own
header rather than client input, and it is still checked to point back into the workspace
before being used as a redirect target (note 05 §36).

## 32.2 Workspace chrome alignment

In every sidebar workspace — Academy, Account, Admin — three edges must agree:

```text
brand column width   ==  sidebar column width
sidebar first item   ==  page heading, same top edge
sidebar scrolls      ->  independently of the content beside it
```

The header's brand column is the same width as the sidebar and carries the same right
border, so the rule under the header and the rule beside the navigation are one continuous
line rather than two that nearly meet.

**The page heading starts level with the first navigation item.** It is the anchor the eye
returns to, and anything stacked above it — an eyebrow naming the workspace, for
instance — pushes it down until it reads against the second or third item in the sidebar
instead. Inside a workspace the sidebar already names the area, so that eyebrow is repeated
chrome bought at the cost of the alignment; the public pages keep theirs, where there is no
sidebar to say it. A workspace page must also not wrap itself in a second container: the
layout already provides one, and doing it twice indents and drops the heading out of line.

The sidebar is sticky and scrolls within its own height, so reaching a navigation item near
the bottom of a long menu does not drag the content beside it out of view.

**Revised 2026-09-05, at the user's direction: no drawn separator.** This section previously
called for "a hairline rule rather than a filled panel" between sidebar and content, and
Academy was built that way — a plain `border-r`. The user rejected it on sight and clarified
what was actually meant: the separation should be the independent scrolling itself (the
short pane visibly staying put while the long one moves), not a static line pretending to
show it. Academy was rebuilt to match Admin's existing sticky-plus-own-`overflow-y-auto`
pattern with no border at all, and this note now records THAT as the standard rather than the
hairline. **Admin still carries a `border-r`** (built earlier and not revisited this round) —
recorded as a known inconsistency rather than silently generalised into a rule either way;
resolve it explicitly if Admin is revisited rather than assuming the newer or the older
choice wins. **Account does not yet implement the sticky/independent-scroll behaviour this
section has described since 2026-09-05** — its sidebar is a plain nav in normal flow. Also
recorded rather than fixed, since this round of work was scoped to Academy only.

**Workspace identity extends into the sidebar itself, not only the 3px strip.** Academy's
active navigation item now carries the workspace's own accent colour (teal) rather than the
same neutral grey Account and Admin use — a `border-l-2` plus a tinted background, using the
semantic `--accent` token, not the large-field `--block-teal` reserved for bands (note 10 §5 —
jewel-block colours are structural page fields, not decoration for small UI elements). The
strip alone was too easy to miss; the difference needed to be visible in the part of the
screen someone is actually looking at while using the workspace, not just the header.

## 32.3 A way back at every depth

**2026-09-05.** Every page reached by drilling into a workspace — not just the top level a
sidebar item names — must offer an obvious, one-click way back to where it was reached
from. The sidebar covers this for any page it links to directly; it does not cover a page
nested BELOW one of those, which is where this was actually missing: `/academy/courses/
[courseSlug]` showed a "Back to your courses" button only when it had no other action to
show, so a course with progress — the normal case — lost it entirely the moment "Continue"
had something to say instead.

**It is a BUTTON, not a text link, and it is one component everywhere
(`components/ui/BackLink`).** A muted-grey "← All orders" text link was the pattern almost
every detail page on the site used — deliberately low-contrast, no button affordance, easy
to miss right where somebody is looking for it. A few pages (checkout's return states)
already used an outline button for the same job, so the site had two answers to one
question. `BackLink` is that outline button, generalised, and every detail page reached by
clicking a card now uses it: blog post, event, catalogue and coaching detail pages, the
membership tier page, order detail, booking confirmation, admin user detail, and both
Academy course and lesson pages.

Two rules behind it:

- **Unconditional.** It renders above the title regardless of what else the page is doing.
  A page's way back must never be a side effect of which action happens to be rendered
  next to it.
- **One level, not a trail.** It names where it goes ("← Your courses", "← Level One"),
  pointing at the place the visitor actually came from, rather than a full breadcrumb
  chain — the lesson page's two-crumb trail was replaced by a single button back to the
  course, since that is what "back" means from inside a lesson.


---

# 33. Task Layouts

Authentication, checkout and booking should use focused layouts where appropriate.

For example:

```text
Auth
→ Branding + focused authentication content

Checkout
→ Branding + transaction-focused content

Booking
→ Branding + booking workflow
```

Avoid unnecessary public navigation during these flows.

---

# 34. Navigation Data vs Components

Navigation definitions should not be duplicated across many components.

Where appropriate, define navigation data centrally and render it through reusable navigation components.

For example:

```text
publicNavigation
academyNavigation
accountNavigation
adminNavigation
```

However, navigation items may need to be filtered based on:

- Authentication
- Role
- Entitlement
- Current workspace
- Feature availability

Navigation data should therefore not be treated as the security layer.

---

# 35. Conditional Navigation

Some navigation items should appear only when relevant.

Examples:

```text
Signed-out visitor
→ Sign In

Signed-in customer
→ Account / Academy

Admin
→ Admin

Customer with eligible Academy content
→ Relevant Academy sections
```

Conditional visibility should improve usability without becoming a substitute for authorization.

---

# 36. Navigation Consistency

Across all workspaces:

- Use consistent typography
- Use consistent interaction patterns
- Use consistent active states
- Use consistent icons where icons are used
- Use accessible labels
- Use predictable placement

However, the visual treatment can differ enough to make each workspace clear.

Consistency does not mean every navigation must look identical.

---

# 37. Navigation Scalability

The navigation architecture must allow new functionality to be added without creating an unusable menu.

When new features are introduced:

1. Determine whether they are public, Academy, Account or Admin functionality.
2. Place them in the appropriate workspace.
3. Group them logically.
4. Avoid adding every new feature as a top-level public menu item.
5. Use landing pages or contextual navigation when a section becomes large.

---

# 38. Canonical Navigation Model

The baseline model is:

```text
PUBLIC
Home
Coaching
About
  Tony's Story
  Meet the Team
  Testimonials
Blog
Catalogue
Contact
Account / Sign In

COACHING
About
Memberships
Courses
Group Coaching
Cohorts
Private Coaching
Retreats

CATALOGUE
Books
Films
Audio
Interviews
Stories From The Front Line
Podcasts
Watch

ACADEMY
Dashboard
Courses
Cohorts
Coaching

ACCOUNT
Overview
Profile
Orders
Memberships
Entitlements
Bookings
Billing
Security
Notifications
Settings

ADMIN
Dashboard
Users
Roles
Products
Memberships
Entitlements
Blog
Catalogue
Courses
Group Coaching
Cohorts
Private Coaching
Retreats
Events
Bookings
Orders
Payments
Emails
Settings
```

The exact visible menu can be refined during UI implementation without changing the underlying route architecture.

---

# 39. Key Navigation Principle

The application should feel like **one Tony Klinger platform**, while each major area should feel appropriate to its purpose.

Therefore:

```text
ONE PLATFORM
     │
     ├── Public Website
     │
     ├── Coaching Storefront
     │
     ├── Academy Workspace
     │
     ├── Customer Account
     │
     └── Admin Workspace
```

Do not create separate applications merely to achieve different navigation experiences.

Use Next.js layouts and contextual navigation to achieve those boundaries within the single application.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-09-04 | §21, §24: `aria-current` separated from visual active state — visual highlighting keeps prefix matching per §24, while `aria-current="page"` requires an exact match and a submenu trigger takes `"true"` at most, being a button rather than a destination. Recorded alongside it that a dropdown must carry a link to its own landing page, since the trigger cannot navigate. |
| 2026-09-04 | §4, §38: About gains a three-item submenu — Tony's Story, Meet the Team, Testimonials — matching the routes in note 03 §5. Previously a single top-level link. |
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1), rendering box-drawing characters, arrows and symbols as mojibake. Restored to `├── └── │ ↓ → ← ≠ —`; each arrow reconstructed from its context (`→` for "leads to", `↓` for flow steps, `←` for active-state markers, `≠` for the two "is not" comparisons in §23). No wording was altered. |
| 2026-08-28 | §8: canonical paths added for the legal pages the footer must carry — `/privacy`, `/terms`, `/cookies`, defined in note 03 §8.2 (closes R11). §19: recorded that the cart sits inside the `(public)` route group and so inherits the public header and footer (closes R10). |
| 2026-08-28 | §9: recorded that a guest on the public `/academy` landing page receives the public layout and sign-in entry rather than the Academy workspace navigation. Supports R14. |
| 2026-08-28 | §14, §15, §38: Entitlements added to the Admin navigation and to the Commerce navigation group, per note 03 §25 and note 06 §23.1. Supports R18. Visibility is permission-filtered by `entitlements.read` (§24). |
| 2026-08-28 | §4, §38: Catalogue menu replaced with the seven canonical categories; individual works are detail pages within a category rather than menu items. Supports R9. |
| 2026-08-28 | §9, §38: Masterclasses added as a permanent Academy destination; recorded that Recordings are deliberately not a navigation destination and are reached through their parent experience. Supports R8. |
| 2026-08-28 | §12, §38: Entitlements added to the Account menu as the customer's own read-only access view. Supports R23. |
| 2026-08-28 | §14, §15, §38: Blog and Catalogue added to the Admin navigation under a new Content group; Masterclasses added to the Learning group. Supports R15 and R8. |
| 2026-09-02 | §4, §5, §38: Give-Get-Go added as a primary navigation item with a five-item submenu — Overview, Publishing, Films, Documentaries and Give-Get-Go Education. The last leaves the site for `give-get-go.com` and is marked with an external indicator, per note 11; it is presented as a related venture and is explicitly not part of the Academy or Admin. |
| 2026-09-02 | §5, §26, §27, §38: **implementation finding** — §5 and §38 define submenus for Coaching and Catalogue, but the desktop header rendered top-level items only. `children` was consumed solely by the mobile menu, so every submenu was unreachable above the `lg` breakpoint. Desktop dropdowns added with hover, click, Enter/Space, Escape-to-close and focus restoration. The mobile menu was rebuilt as a single-expansion accordion in a modal sheet with a focus trap, scroll lock and 44px targets (note 10 §35), replacing a flat list that expanded every submenu at once. |
| 2026-09-02 | §4, §38: primary navigation reordered by importance rather than by build order — Home, Coaching, Catalogue, Give-Get-Go, About, Blog, Contact. Coaching leads as the commercial core; Catalogue precedes Give-Get-Go because Give-Get-Go is a view over catalogue content; Contact stays last by convention. Events remains a footer link (§8). |
| 2026-09-02 | §26, §27: **defect fixed** — the mobile sheet was rendered inside `<header>`, which carries `backdrop-blur`. A `backdrop-filter` makes an element a containing block for its `position:fixed` descendants, so `top-16 bottom-0` resolved against the header's 64px box and collapsed the sheet to zero height: the menu opened, trapped focus and locked scrolling while being invisible. The sheet is now a sibling of `<header>`. |
| 2026-09-05 | §32.2 (new): workspace chrome alignment recorded — the header's brand column matches the sidebar width and border, the page heading starts level with the first navigation item, and the sidebar scrolls independently behind a hairline separation. **Partly reverses the 2026-09-05 amendment that gave every workspace page an eyebrow:** inside a sidebar workspace the eyebrow repeats what the sidebar already says and pushed the heading 32px below the navigation. Public pages keep theirs. |
| 2026-09-05 | §32.1 (new): `x-pathname` stamped by the proxy so a layout-level gate can return the operator to the page they asked for. Without it every deep link into Admin collapsed to the dashboard at the second-factor step. |
