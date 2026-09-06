# Tony Klinger — UI, Responsive & Design/Theme Architecture

**File:** `10-ui-responsive-and-design-theme-architecture.md`

## 1. Purpose

Define the visual, responsive and reusable UI architecture for the Tony Klinger platform.

This note establishes:

- Design tokens
- Theme architecture
- Easy theme changes
- Colour system
- Typography
- Spacing
- Responsive behaviour
- Breakpoints
- Reusable components
- Component states
- Accessibility
- Forms
- Navigation presentation
- Cards and content presentation
- Academy UI
- Coaching UI
- Account UI
- Admin UI
- Dark/light or future theme support
- Consistent visual implementation

The UI architecture must remain separate from business logic, authentication logic and database logic.

---

## 2. Core Principle

The application should use a centralized design system rather than scattering visual values throughout components.

Conceptually:

```text
DESIGN TOKENS
      ↓
THEME
      ↓
UI COMPONENTS
      ↓
PAGES / FEATURES
```

A page should consume the design system rather than repeatedly defining its own colours, spacing, typography and visual rules.

---

## 3. Easy Theme Changes

The site must be built so that the visual theme can be changed easily.

A future theme change should primarily involve changing centralized theme tokens rather than searching through every page and component for hard-coded colours.

For example:

```text
Theme
 ├── Background
 ├── Surface
 ├── Text
 ├── Muted Text
 ├── Border
 ├── Primary
 ├── Secondary
 ├── Accent
 ├── Success
 ├── Warning
 └── Error
```

The exact values should be defined centrally.

---

## 4. Design Tokens

Use semantic design tokens.

Examples:

```text
--background
--foreground
--surface
--surface-muted
--border
--primary
--primary-foreground
--button
--button-foreground
--secondary
--secondary-foreground
--accent
--accent-foreground
--success
--warning
--error
--muted
--muted-foreground
```

Components should consume semantic tokens rather than directly depending on raw colour values.

---

## 5. Brand Colours

**Revised 2026-09-04 (superseding an earlier revision the same day).** Two palettes have
now been retired and both are recorded so the reasoning stays legible. The original
purple/orange scheme (`#1E1B2E`, `#FF9F45`, `#BB86FC`) was rejected by the user. A
near-neutral "cinematic editorial" canvas replaced it briefly and was also rejected: it
was image-led on the reasoning that the catalogue's own artwork should carry the colour,
which directly contradicted the user's first and clearest directive — a **highly
saturated** site.

The direction is **saturated jewel blocks**. Deep oxblood, teal and indigo are used as
large flat colour FIELDS behind content. The colour is structural: it divides a page into
sections a visitor can navigate by hue, rather than acting as trim on neutral cards.

```text
THE BLOCKS — identical in BOTH themes
Oxblood               #7A1F2B
Teal                  #0F4C5C
Indigo                #2E2A6E
On-block text         #F7F3EC   validated 4.5:1 against all three

DARK ground (hero)
Background            #0A0F1F   midnight indigo, not neutral black
Surface               #141B33
Foreground            #F1F0FA
Primary               #FF4D6D   link/label text — bright by necessity, see §5.1
Button                #C62953   filled CTA fill — a separate token, see §5.1
Accent                #2DD4BF

LIGHT ground (warm ivory)
Background            #F6F4EF
Surface               #FFFFFF
Foreground            #16182B   indigo-tinted ink, never pure black
Primary               #A3162F   oxblood, deepened to carry white text
Button                #A3162F   same value as Primary in light mode — see §5.1
Accent                #0B5563
```

**The three block colours do not flip with the theme, deliberately.** They are the site's
fixed identity; it is the ground beneath them that changes from ivory to midnight.
Flipping the blocks as well would leave nothing constant between the two themes. The
semantic ground tokens still carry both values, so §39 is satisfied.

Bands are rationed. Two or three per page: a page where every section is a different
saturated field is not bolder, it is louder, and the hierarchy disappears. The
implementation is `components/layout/Band.tsx`.

**Every pair is validated by `scripts/check-contrast.mjs`**, which parses the token values
out of `globals.css` — rather than duplicating them — and fails the run if any pair drops
below its threshold in either theme. The three block fields are held to the 4.5:1 TEXT
threshold, not the 3:1 non-text one, because they carry body copy. Run it after touching
any colour. This exists because the `--input-border` defect (§35) was found by measuring
and would not have been found by looking.

### 5.1 `--button` split from `--primary`: buttons and links need different colours

**2026-09-05.** The dark-theme primary was `#FF4D6D` — a bright pink that passed 4.5:1
as a button fill (`--primary-foreground` on `--primary`) but read as unclear to the user
regardless of the number. A saturated hue can clear the WCAG threshold and still fail
the eye. The user's own fix, tried first, was the obvious one: darken it and pair it
with white text.

That single-token fix cannot work, and the arithmetic says why. `--primary` is also the
literal colour of inline link and label text set directly on the dark page background in
roughly twenty places (blog "Continue reading" links, account cross-links, section
eyebrows) via `text-primary`. Against that near-black background, legible text needs
luminance ≥ ~0.20. A colour dark enough to carry *white* button text at 4.5:1 needs
luminance ≤ ~0.18. Those two requirements do not overlap — no single colour satisfies
both roles with a white button label. A deeper rose (`#C62953`) with white text was
built and measured to confirm this rather than assumed: 5.5:1 as a button, 3.5:1 as
text, which would have silently broken every one of those links. A same-hue compromise
(`#F53A40`, shifted from pink toward true red, keeping the existing dark button label)
was tried next and technically passed both roles at once — but it produced a visually
similar result to the original and did not read as the fix the user was after.

**Resolution: two tokens, one per role.** `--primary` reverts to its original `#FF4D6D`
and keeps doing exactly what it always did — inline link/label text and UI marks
(dots, progress bars, hover tints) that need to be bright against the dark ground. A new
`--button` / `--button-foreground` pair (`#C62953` / `#FFFFFF` in dark mode) is
introduced for filled call-to-action fills only — `Button.tsx`'s primary variant, the
skip link, membership "Buy"/"Join" buttons, the "Everything included" pill, and the
billing-period toggle's active state — everywhere the previous code paired `bg-primary`
with `text-primary-foreground` for an actual pressable action rather than a mark. In
light mode `--button` is identical to `--primary` (`#A3162F`) — the two only need to
diverge where a single hue cannot serve both jobs, which is dark mode only.
`scripts/check-contrast.mjs` gained a `--button-foreground` on `--button` pair
(5.5:1 dark, 15.9:1 light) so this split cannot silently drift back out of contrast.
All pairs pass in both themes.

---

### Third-party brand colour is exempt

The Google sign-in button uses Google's specified surface, border and text values via
`--google-bg` / `--google-border` / `--google-text`, which do **not** follow this palette.
People identify that control by its appearance, and one restyled into our own colours stops
reading as "the account I already have". They are tokens rather than literals so §38 still
holds, and they carry light and dark values like everything else.

These values should be treated as theme/brand tokens rather than scattered literals.

If the brand palette changes, the implementation should allow the palette to be updated centrally.

---

## 6. Theme Architecture

The theme should be represented as a coherent token set.

Conceptually:

```text
Theme
  ↓
Semantic Tokens
  ↓
Components
```

Avoid creating separate hard-coded colour systems for:

```text
Public
Academy
Account
Admin
```

unless a deliberate product requirement calls for a distinct visual treatment.

The ecosystem should feel like one coherent platform.

---

## 7. Future Theme Support

The architecture should make future themes possible without rebuilding components.

Light and dark are both required at launch (§39). Further themes may be added later:

```text
Light          required at launch
Dark           required at launch
Seasonal / Campaign   possible future
```

The exact theme switcher does not need to be exposed to users unless required, but the
application must be able to render correctly in both required themes.

The important architectural requirement is that the design system is tokenized.

---

## 8. Typography

**Revised 2026-09-04.** Work Sans was the established preference and is superseded. It is a
capable single face, but one face setting both a 72px headline and a 13px label is what
produced the flat, weightless hierarchy the redesign exists to fix.

Two faces, each doing one job:

```text
Display   Fraunces      --font-display   headings, prices, pull quotes
Body      Manrope       --font-body      everything else
```

**Fraunces** carries the editorial voice. It is a variable serif with a real optical-size
axis, so a display headline is drawn with the fine hairlines a large cut needs while a
subhead at 20px stays sturdy — a single optical cut cannot do both and ends up looking
either weedy or clumsy.

**Manrope** sets body copy. A geometric grotesk with enough character to avoid the
system-stack look, and a tall x-height that keeps long descriptions readable at small
sizes.

Both are variable fonts, so the entire weight range costs one file each rather than one
request per weight, and both are self-hosted through `next/font` — no third-party font
request on any page.

Typography should be centralized through the application's design system.

Define semantic typography levels such as:

```text
Display
H1
H2
H3
H4
Body
Body Small
Label
Caption
```

Avoid independently choosing font sizes and weights in every component.

---

## 9. Typography Hierarchy

Pages should maintain a consistent hierarchy.

For example:

```text
Page title
  ↓
Section heading
  ↓
Subheading
  ↓
Body content
  ↓
Supporting text
```

Typography should remain readable across desktop, tablet and mobile layouts.

---

## 10. Spacing System

Use a consistent spacing scale.

Components should generally use predefined spacing tokens rather than arbitrary values.

Conceptually:

```text
xs
sm
md
lg
xl
2xl
3xl
...
```

The exact numeric scale should be defined in the implementation's design configuration.

---

## 11. Layout Containers

Use reusable layout primitives for:

```text
Page container
Content container
Section
Grid
Stack
Flex row/column
```

Maximum content widths should be centralized where practical.

This prevents each page from inventing a different content width.

---

## 12. Responsive-First Principle

The application must be designed for:

```text
Mobile
Tablet
Desktop
Large desktop
```

Do not treat mobile as an afterthought.

Start with the constrained/mobile layout and progressively enhance it for larger screens where appropriate.

---

## 13. Responsive Breakpoints

Use the project's centralized breakpoint system.

The implementation should avoid inventing unique breakpoints inside individual components.

Conceptually:

```text
Mobile
   ↓
Tablet
   ↓
Desktop
   ↓
Large Desktop
```

The exact pixel values should follow the current framework/design-system configuration.

---

## 14. Responsive Navigation

Navigation must adapt to viewport size.

Desktop may use:

```text
Full navigation
Dropdowns / submenus
Account controls
```

Mobile may use:

```text
Menu trigger
Expandable navigation
Nested navigation
```

The same route structure and permissions must apply regardless of presentation.

Responsive navigation must not create a separate navigation authority.

---

## 15. Responsive Content

Content should reflow rather than simply shrink.

Examples:

```text
Desktop grid
   ↓
Tablet fewer columns
   ↓
Mobile single/appropriate column
```

Tables, cards, forms and schedules should receive specific responsive treatment where necessary.

---

## 16. Responsive Images and Media

Images and media should be responsive and optimized.

Use appropriate:

- Responsive sizing
- Aspect ratios
- Lazy loading where appropriate
- Optimized formats
- Accessible alternative text

Large media should not unnecessarily block initial page rendering.

---

## 17. Component Architecture

Reusable UI components should be centralized.

Conceptually:

```text
src/components/
```

with logical groupings such as:

```text
ui/
layout/
navigation/
forms/
content/
academy/
coaching/
account/
admin/
```

The exact directory structure must follow the established Next.js Project & Directory Architecture.

---

## 18. UI vs Feature Components

Distinguish generic UI components from feature-specific components.

Generic:

```text
Button
Input
Dialog
Card
Badge
Tabs
Table
Select
```

Feature-specific:

```text
MembershipCard
CourseCard
SessionCard
BookingPanel
EntitlementStatus
```

Generic components should not contain business-specific rules unnecessarily.

---

## 19. Component Reuse

If two areas require the same visual component, reuse the component rather than creating visually divergent copies.

For example:

```text
Button
```

should be shared by:

```text
Public
Academy
Account
Admin
```

where the same interaction is required.

Feature-specific variants may be created where the actual behaviour differs.

---

## 20. Component Variants

Components should support controlled variants where useful.

For example:

```text
Button
 ├── primary
 ├── secondary
 ├── outline
 ├── ghost
 └── destructive
```

Avoid creating separate components for every minor visual variation.

---

## 21. Component States

Interactive components must define appropriate states.

Examples:

```text
Default
Hover
Focus
Active
Disabled
Loading
Success
Error
```

Components should not rely solely on colour to communicate state.

---

## 22. Loading States

Data-driven interfaces should provide appropriate loading states.

Examples:

```text
Skeleton
Spinner
Progress indicator
Loading button
```

Loading UI should prevent confusing layout shifts where practical.

---

## 23. Empty States

Data-driven pages should have explicit empty states.

Examples:

```text
No courses yet
No upcoming bookings
No orders
No notifications
No search results
```

Empty states should explain what the user can do next where appropriate.

---

## 24. Error States

Errors should be understandable and actionable.

Examples:

```text
Unable to load courses
Booking failed
Payment still processing
Access unavailable
```

Do not expose raw database errors, stack traces or internal implementation details to users.

---

## 25. Forms

Forms should use consistent reusable components.

Form architecture should support:

- Labels
- Descriptions
- Validation
- Error messages
- Required indicators
- Loading states
- Success states
- Accessible controls

Client-side validation may improve UX, but server-side validation remains authoritative.

---

## 26. Buttons

Buttons should communicate action and state clearly.

Examples:

```text
Buy Now
Book Session
Join Cohort
Start Course
Save Changes
Cancel Booking
```

Dangerous/destructive actions should use appropriate confirmation where required.

### Shape

Buttons are **fully rounded** — a pill, not a rectangle with softened corners. The site's
surfaces (cards, panels, inputs) keep the modest `--radius` family, so the shape difference
is what separates *a thing you press* from *a thing you read*. That distinction does more
work than colour alone, and it survives forced-colours mode and greyscale.

The pill applies to every variant, including the outline and on-block variants, so a row of
mixed buttons reads as one control family rather than two.


---

## 27. Cards

Cards may be used for:

```text
Products
Courses
Memberships
Sessions
Cohorts
Events
Resources
```

Cards should use shared spacing, typography, borders, radius and interaction patterns.

Avoid creating many nearly identical card implementations.

---

## 28. Membership Comparison UI

Membership comparison should reflect the cumulative structure:

```text
Silver
 ↓
Gold
 ↓
Platinum
 ↓
Ultimate Membership
```

The UI should communicate that higher levels include previous benefits.

It should not accidentally present the four memberships as unrelated products.

---

## 29. Academy UI

The Academy should use the shared design system while maintaining a focused learning experience.

Typical UI elements include:

```text
Course cards
Progress indicators
Lesson navigation
Session cards
Cohort schedules
Recording links
Resource lists
```

Academy content should remain visually consistent with the overall Tony Klinger brand.

---

## 30. Coaching UI

Coaching pages should support presentation of:

```text
Memberships
Group Coaching
Private Coaching
Cohorts
Retreats
Events
```

Public commercial pages should prioritize clarity of:

```text
Offer
Benefits
Price
Eligibility
Call to action
```

---

## 31. Account UI

Account pages should provide consistent layouts for:

```text
Profile
Security
Billing
Orders
Subscriptions
Bookings
Entitlements
```

`Entitlements` is the customer's read-only view of their access at `/account/entitlements`
(note 03 §24). `Subscriptions` is not a separate route — recurring membership state is
presented through `/account/membership` and `/account/billing`.

Sensitive information should receive appropriate visual treatment and confirmation patterns.

---

## 32. Admin UI

Admin interfaces should prioritize:

```text
Clarity
Efficiency
Data density where useful
Safe destructive actions
Clear status
Search/filtering
```

Admin UI should still use the same underlying design tokens.

It may use denser layouts than public pages without becoming a separate visual system.

---

## 33. Tables

Tables should support responsive behaviour.

On smaller screens, appropriate alternatives may include:

```text
Horizontal scrolling
Stacked rows
Card representation
Reduced columns
```

Do not force wide desktop tables into unreadable mobile layouts.

---

## 34. Accessibility

The application should target strong accessibility.

Requirements include:

- Semantic HTML
- Keyboard navigation
- Visible focus states
- Accessible labels
- Appropriate contrast
- Meaningful headings
- Alt text for meaningful images
- Accessible form errors
- Screen-reader-friendly controls

Accessibility must be considered at the shared-component level so improvements propagate throughout the application.

---

## 35. Colour Contrast

Theme colours must maintain sufficient contrast for readable content and interactive controls.

Do not choose colours solely because they look good in isolation.

When changing the theme, validate contrast across:

```text
Text
Backgrounds
Buttons
Links
Borders
Focus indicators
Disabled states
Alerts
```

---

## 36. Focus and Keyboard Interaction

Interactive components must remain usable without a mouse.

Examples:

```text
Navigation
Dropdowns
Dialogs
Forms
Tabs
Menus
Booking controls
Admin controls
```

Focus must remain visible.

Keyboard interaction should follow established accessibility patterns.

---

## 37. Motion

Animations should be purposeful and restrained.

Examples:

```text
Menu opening
Modal transitions
Loading states
Content transitions
```

Respect reduced-motion preferences where appropriate.

Do not make essential information dependent on animation.

### Motion architecture, recorded 2026-09-04

Timing is centralised as tokens (`--dur-fast|base|slow`, `--ease-out-expo`,
`--ease-out-quart`) so components consume a shared vocabulary instead of inventing
durations. Expo-out reads as *settling*; linear or ease-in-out reads as *sliding*.

**Which mechanism, and why it matters for weight.** GSAP and three.js are both
dependencies of this project, but neither is in the shared bundle:

```text
Reveal on scroll     IntersectionObserver + CSS transition   no library
Parallax             rAF + transform                         no library
Menu / dropdown      CSS transition, `.dropdown-panel`       no library
Hero sequences       GSAP                                    dynamic import, per page
3-D hero element     three.js                                dynamic import, per page
```

A scroll-reveal appears on nearly every section of every page. Implementing it with an
animation library would charge every visitor roughly 40KB to fade text in, which directly
contradicts the performance requirement in §47. The library is used where it earns its
weight — an orchestrated multi-step hero timeline — and dynamically imported so pages that
do not use it never download it.

**Reveals must degrade to visible.** The hidden state is applied by the client *after
mount*, never in server-rendered HTML. If JavaScript fails or is disabled, the content is
simply visible. The opposite arrangement — hiding in the markup and revealing with JS —
produces a blank page on failure, which is the worst outcome for a marketing site and for
search engines.

**Parallax carries a hard accessibility constraint.** It is disabled outright under
`prefers-reduced-motion`, not merely shortened: parallax is a common vertigo and migraine
trigger. It writes only `transform` (never `top` or `background-position`, which force
layout every frame), throttles through `requestAnimationFrame`, uses a passive scroll
listener, and stops computing entirely when its element is off-screen.

### 37.1 Every dropdown/menu/popover shares one open-and-close transition

**2026-09-05.** A dropdown that animates open and then simply vanishes on close reads as
unfinished, and before this every menu on the site invented its own transition anyway —
`NavDropdown` used an enter-only `@keyframes` triggered by toggling `hidden`, `UserMenu`
had no transition or outside-click handling at all. `hidden` (`display:none`) cannot be
transitioned, which is *why* close was never animated: the element was gone the instant
the state flipped.

The fix is one shared CSS utility, `.dropdown-panel` (`globals.css`), used by every
dropdown, account menu, select-style panel and future popover rather than a bespoke
transition per component. The element stays mounted permanently and toggles
`data-open="true"/"false"`; the utility transitions `opacity` and `transform` only
(compositor-only — no layout or paint cost regardless of how many menus use it) over
`--dur-fast` with `--ease-out-expo`, and delays `visibility` by the same duration so a
closing panel leaves the tab order and stops accepting clicks only once it has actually
finished fading, never before. Each usage adds a Tailwind `origin-*` utility so the menu
scales from the corner nearest its trigger rather than always dead centre.

No animation library is involved — this is exactly the class of effect the reveal/parallax
row above already argues should stay CSS-only. GSAP and three.js remain reserved for
genuinely orchestrated timelines and 3-D, per the table above.
`prefers-reduced-motion` needs no separate handling here: the base-layer rule already
collapses every transition's duration site-wide.

---

## 38. Theme Implementation Boundary

Theme values should be defined at the design-system/configuration level.

Feature components should consume semantic tokens.

Avoid:

```text
Feature component
 → hard-coded #FF9F45
```

Prefer:

```text
Feature component
 → primary token
 → theme value
```

This is what makes a future theme change manageable.

---

## 39. Dark and Light Themes

**Light mode is required from launch, alongside dark mode.** It is not deferred and not
optional.

Both use the same semantic token names.

For example:

```text
--background
--foreground
--surface
--primary
--accent
```

Only their underlying values change.

Components should not contain separate hard-coded dark/light colour logic unless required.

Because both themes ship together:

- Every semantic token is defined with both a light and a dark value from the start. A token
  with only one value is an incomplete token.
- Contrast is validated in **both** themes (§35). A palette that passes in dark and fails in
  light is not finished.
- Component states — hover, focus, disabled, error (§21) — are checked in both themes, since
  these are where a single-theme design usually breaks first.
- Building both from the beginning is deliberate: retrofitting a second theme means finding
  every hard-coded value that the token system was created to prevent.

---

## 40. Brand Assets

Brand assets should be centrally managed.

Examples:

```text
Logo
Wordmark
Icons
Favicon
Social preview assets
```

Avoid duplicating different versions of the same asset throughout the application.

---

## 41. Icons

Use a consistent icon system.

Icons should:

- Have consistent visual weight
- Have accessible labels when necessary
- Not replace text where text is required for clarity
- Remain visually aligned with surrounding controls

Do not mix many unrelated icon libraries without a reason.

---

## 42. Content Presentation

The design system should support the content-heavy nature of Tony Klinger's site.

It should handle:

```text
Books
Films
Stories
Interviews
Audio
Podcasts
Blog content
Course content
Resources
```

The Catalogue information architecture is settled: a `/catalogue` hub with seven categories
— books, films, audio, interviews, stories-from-the-front-line, podcasts, watch — each using
the collection/detail model, with individual works as detail pages inside a category and
external works linking out. See note 03 §7–§8 and note 08 §28.2.

Content presentation components live in `src/components/content/` (note 02 §11).

---

## 43. Design Tokens and Tailwind

Where Tailwind CSS is used, the design tokens should be integrated with the Tailwind configuration/current supported theming approach.

The objective is:

```text
Central token
    ↓
Tailwind utility / component
    ↓
Consistent UI
```

Do not create a parallel uncontrolled colour system in arbitrary Tailwind classes.

---

## 44. Server / Client Boundary

UI components should not contain unnecessary server-side business logic.

For example:

```text
UI
 ↓
Server Action / Route Handler
 ↓
Business logic
 ↓
Database / External service
```

The component is responsible for presentation and interaction.

The server remains responsible for authorization and business rules.

---

## 45. Design System Evolution

The design system should be extensible.

Future requirements may add:

- New components
- New token categories
- New themes
- New content layouts
- New responsive patterns
- New accessibility improvements

New components should reuse existing primitives where practical rather than bypassing the design system.

---

## 46. Visual Consistency

The public site, Academy, Account and Admin areas should feel like parts of one platform.

They may have different density and information presentation, but they should share:

```text
Brand
Typography
Core colour language
Spacing principles
Component behaviour
Accessibility standards
```

---

## 47. Performance

UI architecture should avoid unnecessary client-side JavaScript.

Prefer:

- Server-rendered content where appropriate
- Optimized images
- Lazy loading for non-critical media
- Small reusable client components
- Avoiding unnecessary global client state

Do not make the entire application a Client Component merely for convenience.

---

## 48. Mobile Quality

Mobile must be treated as a first-class experience.

Test important flows on small screens, including:

```text
Navigation
Product purchase
Checkout
Academy learning
Booking
Account management
Admin operations where applicable
```

Touch targets should be appropriately sized and usable.

---

## 49. Responsive Testing

Responsive testing should cover representative viewport sizes rather than relying on a single desktop browser width.

Test:

```text
Small mobile
Large mobile
Tablet
Laptop
Desktop
Large desktop
```

Also test content with unusually long titles, names and error messages so layouts remain robust.

---

## 50. Design System Source of Truth

The source of truth for visual styling should be the centralized design system/theme configuration.

Avoid having:

```text
Page A → custom colour
Page B → another colour
Page C → hard-coded spacing
Page D → different button style
```

unless there is a deliberate documented reason.

---

## 51. Architecture Principle

The UI, Responsive & Design/Theme architecture should provide:

**A centralized, reusable, accessible, responsive and tokenized design system that allows the Tony Klinger site's visual theme to be changed efficiently without rewriting individual pages and features.**

The core relationship is:

```text
BRAND / THEME
      ↓
DESIGN TOKENS
      ↓
REUSABLE COMPONENTS
      ↓
RESPONSIVE LAYOUTS
      ↓
PUBLIC / ACADEMY / ACCOUNT / ADMIN
```

The visual system must remain independent from the application's business rules while providing a consistent experience across the entire platform.

---

# Document History

| Date | Amendment |
|------|-----------|
| 2026-09-04 | **§5 palette replaced.** The purple/orange scheme (`#1E1B2E`, `#FF9F45`, `#BB86FC`) is superseded by a cinematic-editorial direction: a near-neutral canvas in both themes, with colour carried by the catalogue's own artwork. Recorded at the user's direction that the previous theme was unwanted and that the site read as generated. Reasoning kept in the note: this catalogue *is* visual material, so saturated chrome competes with the work. New `scripts/check-contrast.mjs` parses the tokens out of `globals.css` and validates every pair in both themes — 38 pairs, all passing. Third-party brand colour (`--google-*`) recorded as a deliberate exemption from §38. |
| 2026-09-04 | **§8 typeface replaced.** Work Sans superseded by Fraunces (display) + Manrope (body). One face setting both a 72px headline and a 13px label is what produced the flat hierarchy; Fraunces has a true optical-size axis so display and subhead sizes are drawn differently. Both variable, both self-hosted via `next/font`. |
| 2026-09-04 | **§37 motion architecture recorded.** Timing centralised as duration/easing tokens. GSAP and three.js adopted but kept OUT of the shared bundle — reveals use IntersectionObserver + CSS and parallax uses rAF + transform, because a library loaded on every page to fade text in contradicts §47. Reveals degrade to visible when JS does not run; parallax is disabled outright under `prefers-reduced-motion` as a vertigo trigger rather than merely shortened. |
| 2026-08-28 | Initial version recorded as supplied. The pasted source had been mis-decoded (UTF-8 read as Latin-1); box-drawing characters and arrows restored to `├── └── ↓ → —`. No wording was altered. |
| 2026-08-28 | §5, §7, §39: light mode recorded as required from launch alongside dark mode — every semantic token carries both values from the start, contrast validated in both themes, component states checked in both. Closes R24. |
| 2026-08-28 | §42: Catalogue information architecture recorded as settled (seven categories, works as detail pages, external works linked out); content components placed in `src/components/content/`. Supports R9 and R15. |
| 2026-08-28 | §31: `Entitlements` mapped to `/account/entitlements`; recorded that `Subscriptions` is not a separate route but is presented through `/account/membership` and `/account/billing`. Closes R23. |
| 2026-09-02 | §35, §36: **defect fixed** — form controls used `--border` (1.30:1 light, 1.44:1 dark), failing WCAG 1.4.11, which requires 3:1 for anything needed to identify a control. An input's box is the only thing marking where it is, so fields were effectively invisible to low-vision users. A dedicated `--input-border` token added (3.62:1 light, 3.75:1 dark); decorative card borders are exempt and keep the softer `--border`. Every other token pair in both themes was measured and passes. |
| 2026-09-02 | §31: skip link added to the root layout and an `id="main"` landmark to all seven layouts (WCAG 2.4.1) — every page repeated the full header before the content a keyboard user came for. |
| 2026-09-05 | §26: button shape fixed as a full pill rather than a softened rectangle, with the modest surface radius reserved for cards, panels and inputs — so shape alone distinguishes a control from a surface, independently of colour. |
