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
Noir                  #0F1513   home hero only — see below
On-block text         #F7F3EC   validated 4.5:1 against all four

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

**One colour field, no teal backgrounds** (owner's rules, 2026-09-24: "my site should not have so many
colours", then "I don't want the colour [teal] at all in my site"). The palette is now:
the ivory/midnight ground, ink text, the warm paper tone (`--surface-muted`) for a
section that needs to stand apart without a colour, **noir** (`#0F1513`) as the one
colour field, and the site red for buttons, links and accents. Noir was sampled from the
black backdrop of the home hero photograph so that photo can be masked into the page.

- `--block-teal` is deleted. `Band` offers `noir` only.
- `--accent` is **deep teal** (`#0B5563` light, `#2DD4BF` dark), **reserved for action and
  state** (owner, 2026-09-24). It covers hover marks, focus rings, the active nav item, a
  selection, the course progress bar, checkboxes, "continue"-type action links and offer
  nudges such as "Save £…". It is never a background field and never static decoration:
  eyebrow labels, bullets, numerals and date badges use the site red (`--primary`). The
  Academy's identity strip stays noir. The day's history: the "no teal" rule was first
  over-applied (`--accent` set to red), then teal was restored as the accent. A trial that
  swapped the site red itself for teal was reverted at the owner's request.
- Light-theme `--secondary` (footer, menus, the catalogue screening room) is noir too, so a
  noir section meets the footer with no seam. Dark theme keeps its midnight panels.
- Oxblood and indigo stay only as the Account and Admin identity strips.

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
Body      Poppins       --font-body      everything else
```

**Fraunces** carries the editorial voice. It is a variable serif with a real optical-size
axis, so a display headline is drawn with the fine hairlines a large cut needs while a
subhead at 20px stays sturdy — a single optical cut cannot do both and ends up looking
either weedy or clumsy.

**Poppins** sets body copy (trial, replaced Manrope 2026-09-24; it is also the legacy
sites' sans). A geometric sans. Fraunces is a variable font; Poppins is not, so it loads
five static weights (300–700). Both are self-hosted through `next/font` — no third-party
font request on any page.

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

### 9.1 One size per heading level (2026-09-24, owner's rule)

Every section heading is the same `h2`, and every page title is one of **two** `h1`
sizes, across the whole public site, checkout and auth. The sizes are tokens in
`globals.css` and are set on the elements themselves in the base layer, so a heading
carries **no** size, leading, tracking or weight class — adding one is how the scale
drifted to ten sizes before:

```text
--text-display  clamp(2.875rem, 1.6rem + 5.2vw, 6.75rem)  raw title-card size (≈100px desktop)
--text-title    min(--text-display, (100vw − 2rem) / 8.8)  landing title card — h1.title-card
--text-h1       clamp(2.5rem, 1.9rem + 2.2vw, 4rem)       every other page title (≈40–64px)
--text-h2       clamp(2rem, 1.5rem + 1.5vw, 3rem)         every section heading (≈46px)
```

**Two page-title sizes (owner, 2026-09-26: "not all major text on all pages needs to be
so big like home page's h1").** The title card — ≈100px on desktop, capped by the screen
width on phones (≈41px at 390px) so a long first line still fits, leading 0.95, tracking
−0.03em — is kept for the **top-level landing pages only**: Home, About, Catalogue,
Coaching, Give-Get-Go, Blog and Contact (the primary-nav destinations). Their `h1` carries
the one permitted heading class, `title-card`; the Blog index sets its parted title words
on `--text-title` directly. **Every other page** — catalogue categories and film/product
detail, coaching listings and product pages, testimonials, events, blog posts, cart,
checkout, legal pages, and the Academy, Account and Admin (`PageHeader`) — uses the plain
`h1` at `--text-h1` (leading 1, tracking −0.025em), which sits clearly above the h2 and
leaves room for long product and post names. This supersedes the 2026-09-25 "every page
at the title-card size" rule. The home hero keeps only a tighter leading (0.92) for its
three stacked lines ("Six decades in film," / "put to work" / "for you.", owner
2026-09-24), which never wrap. Supporting lines under an h1 (a tagline, a lead) are sized
so they stay clearly below it. A title on a card,
a panel or a sidebar ("Summary", "What it costs", an event or offer card) is not a
section heading: it is an `h3` and sizes itself. The Academy, Account and Admin
dashboards keep their compact panel headings (their `h2`s carry explicit sizes, which
override the base rule); their page `h1` is the standard `--text-h1`.

**Auth titles are the one page-title exception (owner, 2026-09-25).** The `/auth/*` screens
set their `h1` at `--text-auth-title` — `clamp(2.25rem, 1.8rem + 1.4vw, 3rem)`, ≈36px on a
phone and 48px on desktop — applied once, in `AuthCard`. An auth title labels a short task
in a narrow form column beside the stage panel (§42.3). At the title-card size, "Create your
account" broke into three lines and pushed the form below the fold. It keeps the display
face and the title-card rise. No other page may use the token.

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

The widths live in `components/layout/Container.tsx`:

```text
narrow    48rem (768px)    long-form reading, centred calls to action
default   76rem (1216px)   the content column of every page
wide      90rem (1440px)   header, footer and the catalogue's wall of work
```

The content column is deliberately narrower than the header and footer (owner's call,
2026-09-24: 72rem felt narrow, 80rem too wide): the body sits inset from the chrome instead of sharing
its edges. Full-bleed photo banners set their words on the same 80rem measure as the
content (76rem), not on the header's.

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

**Which mechanism, and why it matters for weight.** Every motion on the site is now
hand-rolled CSS or a few lines of script; the project has no animation library (three.js
was removed 2026-09-24 with the old hero, and GSAP the same day with `ScrollPan`):

```text
Reveal on scroll     IntersectionObserver + CSS transition   no library
Parallax             rAF + transform                         no library
Menu / dropdown      CSS transition, `.dropdown-panel`       no library
Hero entrance        CSS keyframes (`line-rise`, `settle`)   no library, no JS
Credits marquee      CSS keyframes (`marquee`), `Marquee`    no library, no JS
Carousel             scroll-snap + timer, `Carousel`         no library
Looping strip        rAF offset loop, `LoopingStrip`         no library
Reading progress     CSS `animation-timeline: scroll()`      no library, no JS
Poster wall          CSS keyframes (`marquee`), `PosterWall` no library, no JS
```

**`LoopingStrip`** (2026-09-24) is for a strip the owner wants to keep gliding like the
credits marquee — the home catalogue — while still honouring the back-and-forth rule
below. One requestAnimationFrame loop owns a single offset: it creeps forward at a steady
speed, and previous / next add an eased one-slide jump on top without stopping the glide.
The set is rendered twice and wraps at one set's width; the copy is `inert` and
`aria-hidden`. Same pause conditions and pause button as `Carousel`; under reduced motion
it never glides and the buttons step instantly.

**Reading progress** on an article is a hairline in the
state colour (teal `--accent`) filled by a scroll timeline; where scroll timelines are
unsupported or motion is reduced it is not shown at all, rather than frozen.

**`PosterWall`** (2026-09-25) is decorative motion under the catalogue hub's title: each
row reuses the `marquee` keyframe over a doubled track, at unequal speeds so rows never
fall into step. It moves by itself for more than five seconds, so WCAG 2.2.2 applies: a
visible **Pause motion** control — a real checkbox — pauses every row through `:has()`,
with no script. Under reduced motion the rows are static and the control is hidden.

**Carousels move by themselves, never with page scroll** (owner's rule, 2026-09-24).
Every slider on the site is the shared `Carousel` (`components/motion/Carousel.tsx`): a
native scroll-snap row, so swipe and keyboard scrolling work with no code and the strip is
complete without JavaScript, plus a timer that advances it and previous / pause / next
buttons. The scroll-scrubbed GSAP pan it replaced was rejected because it tied the strip
to the reader's scrolling. Autoplay pauses under the pointer, with keyboard focus inside,
when the tab is hidden and when the strip is off screen, and never starts under
`prefers-reduced-motion`. The pause button is not optional: WCAG 2.2.2 requires one for
anything that moves on its own for more than five seconds, and hover-to-pause does not
exist on a phone. Forward wraps to the start and back wraps to the end. **Whole slides
only** (owner, 2026-09-24): a slide is never shown cut off at the edge — slides are sized
as exact fractions of the row (`w-full sm:w-1/2 lg:w-1/3`), never fixed widths, so every
snap position shows complete slides. Progress is a bar
spanning the visible window, not an "n / total" counter, which cannot reach its total
when several slides are in view.

**The home hero is CSS, not a library** (2026-09-24). The headline rises line by line out
of a clipping mask, the photo settles from a slight push-in, and a blurred oxblood glow
drifts behind the type. All three are keyframes in `globals.css` that play from the
server-rendered HTML, so the hero moves on first paint rather than after hydration, and
each usage sets `motion-reduce:animate-none` itself — the base reduced-motion rule
shortens durations but leaves `animation-delay` intact. Only `transform` is animated on
the headline, never opacity, so the text is painted from the first frame.

**three.js is retired.** The wireframe `HeroCanvas` behind the old home hero was removed
with the hero redesign, and `three` with it. A photograph dissolved into a matched field
does the job the canvas did — depth and production value — at no bundle cost, and a
wireframe over a portrait competed with the face.

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
row above already argues should stay CSS-only.
`prefers-reduced-motion` needs no separate handling here: the base-layer rule already
collapses every transition's duration site-wide.

**2026-09-24 — timing revised.** At the owner's request the panel now eases in *and*
out rather than snapping: `--ease-in-out-menu` (`cubic-bezier(0.45, 0, 0.2, 1)`) over
`--dur-menu-in` (280ms) to open and `--dur-menu-out` (220ms) to close, scaling from
`scale(0.9)` with no slide, so each usage's `origin-*` alone sets where it grows from. The
header menus (`NavDropdown`) now use `origin-center` and grow outward from their middle, at
the owner's request. The account menu keeps `origin-top-right`. The `visibility` delay
follows the close duration. It is still compositor-only and still the one shared utility.

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

### 42.1 The catalogue as a studio slate

The catalogue is presented as a studio presents its work, not as a card index:

- **Hub: a wall of the work** (revised 2026-09-25, owner). The hub opens on
  `PosterWall` (`src/components/catalogue/PosterWall.tsx`): four rows of every poster in
  the catalogue drifting sideways in alternating directions, tilted, darkened toward the
  middle, with the title, lede and one button centred over it. Below, **collection
  cards** — one per collection that has published work, each with its first works
  fanned inside (spreading on hover), a glow of their colour, the name and a line. A
  work without artwork stands in the fan as a `GeneratedCover` of its title. A
  collection with nothing published still has its card — one cover drawn from its name,
  a "Coming soon" label, not linked, not dimmed — and becomes a link once a work in it is
  published. The hub does not list individual
  works; each collection's page does (owner). **Every fan is three cards** (2026-09-26,
  owner): a collection with fewer than three pictured works fills the empty places from
  `fanFillers()` (`src/lib/content/catalogue.ts`) — its works' own gallery images, then
  the cover and gallery of the same title's other editions elsewhere in the catalogue
  (the Butterfly Boy audiobook draws on the book) — and only then with plain uncoloured
  sleeves. With a lone work and two fillers, the second filler takes the middle so two
  editions sharing artwork never sit side by side. On the hub, Audio and Stories From The
  Front Line swap places (hub order only; `CATALOGUE_CATEGORIES` is unchanged).
- **Category: premiere stage plus wall** (stage revised 2026-09-26: the owner found the
  category heroes dull). `ScreeningHero` is centred — eyebrow, the h1, lede — on a
  grained ink field lit two ways: the collection's covers blurred and saturated into
  coloured light that drifts into place once on load, and a pale spotlight from above.
  Beneath the words, `PosterFan` deals up to five posters from one stack into a fan
  (the `deal` keyframe, staggered from the middle out), larger than before, spreading on
  hover and hanging over the field's edge into the page; phones show the middle three.
  A collection short of three covers is filled by `fanFillers()`, as on the hub. All
  motion is a one-time entrance, transform/opacity only, so nothing needs a pause
  control; reduced motion shows the finished frame. No words-beside-a-picture split
  (owner). Then every work as a bare poster or a two-column still. The separate
  "spotlight" was removed: it repeated the fan's first poster directly beneath it.
- **Works awaiting their link** (2026-09-26, owner). A recording or video in Watch,
  Interviews, Podcasts or Audio that has no link yet is still listed, with its cover,
  marked "Coming soon", and is not clickable: no link, no hover (`awaitingLink()` in
  `src/lib/content/catalogue.ts`). It becomes a normal card when its link is set.
- **The wall's last row is centred** (2026-09-25, owner: "desktop and above"). A grid
  ends flush left, so a collection whose count did not fill its final row trailed off into
  empty space (Watch's third video sat alone beside half a blank row). `WorkWall`
  (`src/components/catalogue/WorkWall.tsx`) replays the grid's own `grid-flow-dense`
  placement to find the works on the final row, and centres them beneath the grid at
  exactly the column widths — every row above is unchanged. Full last rows stay in the grid.
- **Show artwork sits whole** (2026-09-25). In podcasts, interviews and audio, a square
  or landscape cover — a show's artwork or a radio video's thumbnail, lettered edge to
  edge — is shown uncropped in the middle of the 3:4 poster frame over a blurred copy of
  itself, with the title beneath. The 3:4 crop cut the lettering ("HOPE fm" read "OPE")
  and a landscape still's overlaid title collided with it. One rule decides this for
  both the card and the wall layout: `showsWhole()` / `wallForm()` in
  `src/lib/content/catalogue.ts`. Watch is excluded (its covers are plain video frames,
  best as full-width stills), and books and films keep their chosen `cover_focus` crops.
- **Listening on the work page.** A work with hosted recordings plays them in its title
  card with `AudioPlayer` (`src/components/media/AudioPlayer.tsx`): one native `<audio>`
  element under the site's own controls — a red play button, a scrubber that is a real
  range input announcing "12:04 of 40:31", part buttons for a recording in parts, the
  next part following on. `preload="metadata"`, so nothing downloads until asked.
- **No numbers or counts** anywhere in the catalogue (owner, 2026-09-25): no row
  numbers, no "No. 03" on posters, no "No. X of Y" on a work, no "N works".
- **Work as one-sheet plus reading room** (revised 2026-09-26). The same `ScreeningHero`
  stage as its collection: breadcrumb, title, line, player and link buttons centred over
  the work's own artwork and gallery blurred into light, and the artwork itself — whole,
  at its true ratio, still linking to the original — lowered beneath them (the `hang`
  keyframe) over the field's edge, its credit under it. This replaced a poster-beside-
  title split, which the owner's no-split rule excludes. The gallery heading no longer
  shows an image count. Below come
  an editorial column (a short first paragraph is set as a lede, and `## ` paragraphs
  become section headings), a horizontal "Stills & artwork" filmstrip, and
  previous/next links between works that have pages.

**Shape decides layout** (`coverShape()`, from `resources.width/height`, migration 0011).
A portrait or square cover is a poster in the 3:4 frame. A landscape cover (ratio ≥ 1.15)
is a **still**: it spans two columns of the wall as a background-image tile, with its
title and line set over a dark gradient. The wall uses `grid-flow-dense`, so
posters fill the gaps stills leave. A work's own page shows its artwork **uncropped at its true
ratio**: a landscape image runs full width above the title. Cropping happens only in
thumbnails, where for every landscape work it dropped from 40–64% to about 0–20%.
Old-site art whose shape was false is corrected at the source; Twilight of the Gods'
jacket, photographed on a wide white ground, is trimmed (`supabase/content/images/`).
The wall uses two columns on phones, four from `md`, and **five from `lg` (desktop and
above, owner 2026-09-25)** — never three. Five is chosen per collection: if five would
leave a gap mid-grid that no poster can fill (a collection of stills, like Watch: two
stills fill four of five columns), that collection keeps four on desktop. `WorkWall`
decides this by replaying the dense placement.
Do not use `min-height` on an element sized by `aspect-ratio`: it widens the box instead,
and that overflowed the phone layout.

### 42.2 Masthead and end credits

The header and footer frame every public page in the same studio language as the catalogue.

- **Masthead (`PublicHeader`).** A "TK" monogram and the name in the display face (the
  `Wordmark` component), with "Producer · Author · Coach" beneath it at `xl`. Navigation
  is set in small tracked capitals (`navStyles.ts`), with a growing underline. On the
  right are a cart icon and **Sign in** as the masthead's one filled button, or the account
  menu when signed in. There is deliberately no "Book coaching" button in the header (the
  owner's call, 2026-09-24); coaching is reached through the navigation and the footer's
  CTAs. It aligns to the wide grid. By width:
  - **Phone:** mark and Menu.
  - **Tablet:** mark, Sign in and Menu.
  - **Desktop:** everything.
- **Dropdown panels (`NavDropdown`).** The header's own paper surface (`bg-background`,
  solid), attached flush to the bar's bottom edge: squared where it meets the bar, rounded
  below, with a hairline border, the lift shadow and a short red rule under the trigger.
  It reads as the masthead folding open (owner, 2026-09-24). It replaced an ink panel that
  hung off the cream header as a separate black box on every light page. The panel shows
  the section name in the display face (never wrapping at a hyphen), the section's
  `description` (a `NavItem` field) with a divider beside it, and its links, in two columns
  when there are more than five. Placement: the trigger is centred in the 4.5rem bar, so
  the panel sits at `top: 50% + 2.25rem` from the trigger, and a `before:` strip bridges the
  gap so the pointer can travel down without closing the menu. It follows the theme, and
  matches the account menu, which was already light. The panels keep `.dropdown-panel`
  (§37.1), and the centring translate sits on a wrapper so it doesn't override the panel's
  transform. The mobile menu stays a full-screen ink takeover.
- **Mobile menu (`MobileNav`).** A full-screen ink takeover with numbered sections in the
  large display face. Sections rise in one after another (`menu-rise`, motion-safe) and
  expand accordion-style with their description, with Sign in (or the account) and the cart at the foot.
  The focus trap, Escape, scroll lock and focus return are unchanged.
- **Footer (`PublicFooter`): one compact band.** On the left are the wordmark, one line
  and the newsletter as a single underlined field (`NewsletterSignup` `compact` variant:
  same consent box, honeypot and privacy wording, about a quarter of the height). On the
  right are three curated columns (`footerColumns`: The work, Coaching, Studio). Below come
  the name as a quiet 12.5vw signature, then the legal line (`legalNavigation`) and "Back
  to top". A first version stacked a closing slogan with CTAs, a full-width "Stay in
  touch" block, every submenu as columns and an 18.5vw signature. The owner rejected it as
  too long and generic, and it was cut to about 540px at desktop width.
- **`.on-ink`** (globals.css) re-points the page tokens at on-dark values for a subtree.
  Components placed on ink, such as the newsletter form, Buttons and link lists, render
  correctly without dark variants.
- **Build note.** `cn()` is a plain join. To hide a `ButtonLink` responsively, hide a
  wrapper: `hidden` beside the button's own `inline-flex` loses, and that put the CTA on
  phones, pushing the Menu toggle off-screen.

Rules kept from before: every poster shares one 3:4 frame and fills it (§23,
`cover_focus`); only works that lead somewhere react to hover (`workHref`, note 08
§28); motion respects `prefers-reduced-motion`; hover glows are the cover itself at
64px, never an accent colour.

---

### 42.3 Design photography across the site

**2026-09-24, at the owner's request.** The public site is saturated with the
client-supplied photographs in `public/images/` (note 08 §60.1.2), each one placed
**once** across the site. Placements are named in one registry,
`src/lib/site/design-photos.ts`, and pages import their photo by name. Adding a
placement means picking a file that isn't listed there yet.

Photos appear in three forms (`src/components/media/DesignPhoto.tsx`), all of which
render the photographer's credit through `<PhotoCredit>`. The photographer's name in
the credit links to their own site (for Danny Clifford, `https://www.dannyclifford.com/`,
opening in a new tab). `photo-credits.ts` records a name and an optional URL per
photographer:

| Form | Use | Where |
|------|-----|-------|
| `DesignPhoto` | A framed photo beside text, with an optional slow drift inside a fixed frame | Home coaching pitch; the coaching landing hero; `PageHeader` |
| Dissolved hero | The photo is masked into a field matched to its own backdrop, with no frame; bespoke per page (`block-noir`, §5) | Home hero, About hero, Contact hero |
| `PhotoBanner` | A full-bleed parallax field, optionally carrying one line | Home, About, Coaching, Memberships |
| `PhotoMosaic` | An editorial grid (one lead frame, four tiles), with one shared credit | About |
| `PhotoSplit` | The photo fills one half of the screen edge to edge, with the words in the other half; the credit sits on the photo's corner. | Home (About Tony) |

`PageHeader` takes an optional `photo`, which turns the header into a split: words on
one side, the photo on the other, stacked on phones. Coaching About, Courses, Cohorts,
Group Coaching, Private Coaching, Retreats, Testimonials, Blog, Events and Give-Get-Go
use it.

**Welcome (`/welcome`, owner 2026-09-26: "easy to read, straight to the point")** is not a
split. It is a centred noir `Band` with a small round portrait (its credit on the overlay
chip in the band's corner, since the portrait is too small to caption), a first-name
greeting at the standard `h1`, one line of copy and ONE primary action back to `next`,
followed by three short icon items (library, sessions, account) on the page ground.

**The credit never competes with the page's words** (owner's rule, 2026-09-24). It is
always small (10px), always bottom RIGHT, and never set in a text column beside a
heading: right-aligned under a framed photo, or on a faint chip in the corner of a
banner, split or the home hero. `PhotoCredit` owns its position and size; callers pass
only a colour.

Rules learned from checking the crops:
- **Banners frame high by default** (`object-[50%_22%]`). These are portraits, and a
  centred crop of a wide field takes the top of the head off. Each placement can set its
  own `focus`.
- **Full-length shots go in frames, not banners.** In a full-length shot the head sits at
  the very top edge, so a wide, short field always clips it; a 4:3 or 4:5 frame shows the
  whole height.
- **Photos from the same shoot shouldn't sit next to each other** on one page.
- **A page's first three photos each use a different format** (owner's rule, 2026-09-24).
  A fourth may repeat a format. So the home page runs dissolved (hero), split (About Tony),
  banner, then framed (coaching). Section order: hero, "On set with", About, career
  timeline, "Six decades" banner, catalogue, coaching, testimonials, closing — the
  timeline (no photo) separates the split from the banner.
- **Never three photo sections in a row.** Two can sit together, but a section without
  a photo has to break any longer run. The home banner moved below the catalogue band
  for this reason.
- **Yellow is rationed** (owner's rule, 2026-09-24). Eight photos share a yellow
  backdrop, tagged `yellow` in the registry. At most two page heroes use one (About and
  Give-Get-Go since 2026-09-24; home and About before that), and no two neighbouring sections on a page are both yellow. The rest sit
  mid-page, next to sections with no photo or a different backdrop.
- **Parallax is motion only.** Everything is `transform`, and it is disabled under
  `prefers-reduced-motion` (§37).

Deliberately not placed: `extra-23b3b03e`, a phone screenshot of a BBC Sounds page. It
carries third-party branding and another person, and it isn't a photograph the
photographer credit can honestly cover.

**A photo should show what the page is about** (owner, 2026-09-24). The coaching landing
hero had been a studio portrait beside copy about six ways to work with Tony. It now
uses `talk-conversation.avif`, which shows Tony mid-explanation with two people after a
talk. The photo comes from the old main site's news archive (`IMG_0115`). It is the
first file in `public/images/` that isn't from Danny Clifford's shoot, so it has no
entry in `photo-credits.ts` and renders no credit until the client names the
photographer. The portrait it replaced (`tk-dc-0-17`) is now unplaced and free for
another page. The migrated library (`current-website/*/site-files`) has more photos of
Tony at talks and Q&As (the `IMG_01xx` series, the Tyneside and Watershed Q&As) for any
page that needs coaching in action.

**Home, same day (owner).** Three more changes on the home page:
- **Coaching pitch (superseded 2026-09-26):** the owner found the section too big and long and said it needs no image. It is now a heading with one line beside it, then the offer table with tighter rows and course titles only; the photo, the three-problem list and the three figures are gone, and `homeCoaching` is unplaced. Earlier: it used `talk-small-group.avif`, Tony seated among a small group, from the same evening as the coaching hero but on a different page. It replaces the framed warehouse portrait (`extra-d64ac0c2`, now unplaced). The photo is no longer in a frame. From `lg` it runs to the right edge of the screen and the full height of the words, masked out leftwards and downwards into the paper tone. On phones it leads the section and fades downwards. That makes it the page's second split-style photo, which the fourth-photo rule allows. The copy's three problems are set as a numbered list.
- **Six decades:** Tony stands dead centre in the photo, so on a full 3:2 field the words sat on his face. From `md` the photo takes the right 62% (58% from `lg`) and dissolves leftwards into noir. On phones it takes the top 62% and dissolves downwards, with the words beneath it.
- **Closing band:** it carries a faint (10%) black-and-white still of Tony beside a film camera outside a cinema (`cinema-camera-bw.avif`, uncredited). It's decorative, with empty alt text. `Band` gains a `backdrop` slot for a full-bleed layer behind the content.

**Scroll-driven motion (§37, 2026-09-24).** The About chapter rail and its numerals animate on `animation-timeline: view()`. This is compositor-only (`transform`, `color`), needs no JavaScript and is gated by `@supports` and `prefers-reduced-motion: no-preference`. The resting style is the finished state, so a browser without scroll timelines loses nothing but the motion. This is the pattern to reuse for any future scroll-linked effect, in place of a scroll listener.

**Hero text start height (owner, 2026-09-25).** On every page, from `lg`, the hero's first line of text (the eyebrow, or the h1 when there is none) starts at the same height on screen as on the home title card. The shared value is `--hero-text-top` (`clamp(5.5rem, 17svh, 10rem)`, measured from the foot of the site header), set in `globals.css`. It is used by the home hero (which is top-aligned from `lg` rather than centred), the About hero, `PageHeader` (all variants, less the `Section`'s 4rem), the coaching landing page, `/about/testimonials` (no breadcrumb since 2026-09-25) and `ScreeningHero` (which also moved to the default content column, so its words line up with the home page's left edge). The coaching layout lowers the value by its 3.5625rem sub-nav, so its pages land at the same height on screen. A new page hero must start its words at this height. Horizontally, hero text sits on the default content column, except where a page is deliberately centred or narrow (membership pricing, legal pages, Coaching About).

**About pages (owner, 2026-09-24; reworked 2026-09-25).** The `/about` hero is noir, with the cap portrait against a dark blue wall (`extra-fe79e111`, moved from Events) dissolved into the field rather than boxed beside it. It was chosen because it looks nothing like the home page's photos. The blue looking-up portrait was dropped as a twin of home's About Tony frame and moved to Events. The portrait fills the right three-fifths as an oval pool of light (a radial mask), so its edge curves into noir rather than meeting the words at a straight line. A linear fade at the foot keeps the timeline on solid noir. The words take the left 64%, so the tagline sets on two lines. The words sit on the solid noir, never over Tony, so they always read. On phones the portrait leads at full width and fades at its foot, and the words rise onto the fade. The chapters run across the hero's foot as a timeline: a hairline, a red node per chapter, era and title, each a jump link. After the story, the black-and-white portrait is no longer a `PhotoBanner`: that format cropped the wide frame to Tony's head. It is now a noir section with the photo anchored in the right two-thirds, dissolving into noir, and the line beside it. On phones the photo leads in a portrait crop. Chapter covers sit on one row from `sm` and in two even rows on phones, so no cover is ever left alone on a line. Its first three photos use two dissolved frames (the hero and the line) around the story, then the mosaic. The About hero is no longer yellow, so Give-Get-Go is now the only yellow hero. Chapter covers are catalogue artwork, not design photos, so they don't count towards the photo-run rule. `/about/testimonials` (redesigned 2026-09-26, owner: a different design with the same photo) opens on a noir **screening room**. The Tyneside Cinema Q&A photo (`tyneside-qa.avif`, from the old main site, uncredited) fills the screen below the masthead (owner, 2026-09-26: stretch it out, larger photo). The header is `min(100svh − header, 60rem)` tall, and the photo runs its full height, centred at 3:4 with its sides dissolved. A blurred, dimmed copy fills the width behind it like projector light. (A plain landscape crop would cut the screen's title or the men on stage.) On phones the photo is wider than the screen and fills it. The eyebrow, h1 and intro sit centred on the photo's dark foot (the audience), over a noir gradient. There is no lead quote band after it: the owner removed it (2026-09-26) because the slider already carries every voice, and that quote now joins the slider. It replaced a page-ground split with the photo in an arch, a pinned quote and three count figures (rejected as cluttered, and split heroes are out). The "Every voice" section uses an underlined tab bar for its filters. Since 2026-09-26 the voices slide on the shared `Carousel`, two at a time from `md` and one on phones (owner: the three-column masonry wall was too clustered). Named and survey voices alternate: named voices sit a step larger on the paper tone with an initials monogram, and survey voices sit in a hairline-bordered card. Each voice carries its context label. The earlier header photo `tk-dc-0-8` is now the auth stage photo.

**Eyebrows: red is the dash, not the words (owner, 2026-09-26).** Every tracked-caps label
above a heading is the shared `Eyebrow` (`src/components/ui/Eyebrow.tsx`). Its words are
in the surrounding text colour at 70% (`text-current/70`, so it reads on the page ground
and on noir without a tone prop). The site red appears only as a hairline dash before the
label, or on both sides when it is centred. `PageHeader` uses it too. Do not set an
eyebrow in `text-primary`.

**Coaching overview (owner, 2026-09-26: "award-winning"; below the hero redone the
same day: "no section should be congested").** `/coaching` opens on a full-bleed photograph
of coaching as it happens (`talk-conversation`), darkened at its foot, with the words over
it: not a split hero. From `lg` the photo is set in from the left (`left-[30%]`) and feathered
into the noir, so the people sit right of the words, and the words start at `--hero-text-top`
like every other hero. Its h1 is below the title-card size (≈44–76px; owner, 2026-09-26: at
full size it crowded the photo), a deliberate exception to the landing rule in §9.1. Sections sit at `py-20 sm:py-24` with centred headings. The owner rejected both
extremes the same day: first the columns as congested, then a `py-28 sm:py-40` pass as
excess space. **Ways in** is one row of three compact cards, one per way of working (On your own,
With a group, One to one). Each has a short 16:9 photo strip (`courses`, `aboutTalk`,
`privateCoaching`), the way and one line, then its offers as tight rows with "from" prices
read from the storefront. It is about one screen tall. The owner rejected in turn stacked
offer boxes (congested), full-width photo chapters (too long, tiring) and oversized photos.
There is no numbering. **How it works** is on noir and set like a programme: five words down the page with one
sentence each, closing on the no-double-charge promise. **Membership** is four equal cards
on the page ground (not the paper tone, owner): name, "Everything in X, plus", what the tier adds, and the monthly price
set large. **On camera** is on noir: every filmed testimonial in the shared `Carousel`, which
stops autoplay for good when a clip is played (`VideoFacade` dispatches `media:play`).
**In writing** shows one large centred quote at a time in a slow `Carousel`, a different
shape from the home page's quote rail. The page closes with a centred "Not sure where to
start?" on the page ground under a hairline. The owner rejected the paper tone
(`surface-muted`) for both this and Membership. The yellow `coachingBanner` is unplaced, and the boxed `Testimonials` component is
deleted.

**Coaching listing pages (owner, 2026-09-26).** Courses, Cohorts, Group Coaching, Private
Coaching and Retreats have **no hero photograph**: a text-only `PageHeader` (eyebrow, h1,
one sentence), then the offers. What matters is each offer's cover, which must be **a
photograph of what the product is about**. There are no typographic title cards and no
generated gradients where a real image exists. The covers are CC0 photographs from
StockSnap, found through Openverse (`supabase/content/images/CREDITS.md`), and are assigned
by `scripts/import-images.mjs`. Cards **own the page**: `OfferGrid` sets the columns by
count. One offer becomes a feature card across the row (`OfferCard feature`: image beside
the words), two or four sit two to a row, and three or more run in threes from `lg`. The
"8 / 3 hrs / 24 hrs" and "4 / 8 / 32" figure tiles are gone (no count stats), along with
the boxed cohort aside, which now lives in the header sentence. Series curricula use white bullets
rather than numerals (owner, 2026-09-26). On the membership cards each included benefit is a
**check in a soft teal disc** (`bg-accent/12 text-accent`), the modern pricing-card
convention, with teal as the site's state colour. The billing term ("Renews monthly") is not
a benefit, so it follows the list as a quiet muted line. The owner tried red and then white
dots there and found both weak. The `cohorts`, `groupCoaching` and `retreats` design photos
are unplaced.

**Offer cards (owner, 2026-09-26: "equal in size, prices must be visible, not boring").**
`OfferCard` is a ticket. It opens on a photograph in a fixed 4:3 frame, with **the price
pinned to it as a tag: large figures, white on the button red**, which reads on any
photograph ("one payment", "a month", "a session", or "from"). Below is a noir body with
the level eyebrow (grey words, red dash), the title clamped to two lines, the description
clamped to three, and a foot holding the meta line and a CTA pill that fills on hover.
Cards in a row are equal: they stretch to the row and a spacer pins the foot. Every
listing uses it, and Group Coaching passes its curriculum in as children and states its
prices from the shared single-session and eight-session products. A lone offer uses the
`feature` layout, with the photo beside the body. Course covers are cinematic (a cinema
camera rig; a vintage cine camera in warm light), picked because the owner found the
first ones plain.

**Product detail pages (owner, 2026-09-26: "award winning, easy to read, price must be
visible").** Every coaching product page (course, cohort, group series, private coaching,
membership tier) is built from `src/components/coaching/ProductPage.tsx`. **`ProductHero`**
is the product's own cover, full bleed and darkened from the top, carrying the back link,
the level eyebrow, the title, one line and the price as the same red tag the card wears.
From `lg` the words are **top-aligned**, not anchored to the foot of the photo. The
**back link sits at `--hero-text-top` minus 3.5rem**, and the eyebrow and title sit a step
(2rem) lower than `--hero-text-top`, so the level eyebrow does not crowd the link (owner,
2026-09-26). The back link is a bordered pill with a larger arrow, on a translucent noir
fill so it reads over any cover. The hero fills the screen below the header, less 2rem at
the fold, capped at 60rem. Membership
tiers, which have no artwork, use the `memberships` portrait. **`ProductFacts`** is one quiet
row of labelled facts (length, format, group, start), not boxed numbers. **`ProductLayout`**
is a reading column beside a sticky **`PurchasePanel`**: the price set large, the buy
buttons (`OwnedState plain` so it does not draw a second card) and a footnote.
**`CheckList`** ticks included items with the teal check. **`MobileBuyBar`** pins the price
and the next step to the foot of a phone screen below `lg`. The public "(note 07 §17)"
reference and the "tier N of M" label were removed. There is still **no retreat detail
page**: retreat cards link to `/coaching/retreats/<slug>`, which 404s, and this is hidden
only because the one retreat is a draft.

**Display serif only where it is large and heavy: a trial in the coaching section (owner,
2026-09-26).** The owner finds the display serif (Fraunces, which the owner calls
"Montserrat") hard to read except where it is big and bold. In `/coaching/*` it is now used
only for headings (h1, h2, card and section titles, the How it works step words, tier names)
and for prices. Reading text in the display face (fact values, the cohort lead paragraph,
the no-double-charge promise, testimonial quotes, video captions and small panel headings)
moved to the body face (Poppins) at medium weight. `TestimonialVideoCard` takes
`plainCaption`, which now defaults to on. **Applied site-wide the same day** at the owner's
request: 25 reading-text uses outside coaching moved to the body face (hero subtitles on
About and Contact, the catalogue intro and work leads, the About chapter leads, the names
and roles lists, testimonial quotes on the wall, the footer tagline, and small numerals). Headings, big statements, prices,
figures, quote glyphs, menu labels and the wordmark keep the serif. The owner may ask for
this to be reversed. **Testimonials never use the display serif** (owner, 2026-09-26, after a brief return to it
in the home carousel): every testimonial quote on the site is in the body face at medium
weight, including the About page's closing quote (the testimonials page lead quote was removed 2026-09-26). Only
the quote glyph stays in the serif. The home carousel sets every quote at one size (15px on
phones, 20px from `sm`, line height 1.5–1.55); each slide has a minimum height (15rem, 16rem
from `sm`) and the carousel's `fitHeight` option sizes the strip to the slide in view, so
only a long quote makes the section taller.

**Auth screens (2026-09-25).** Every `/auth/*` page is a split screen (`src/app/auth/layout.tsx`).
On the left is the noir **stage** (`AuthStage`), in the home title card's vocabulary: grain,
the drifting oxblood light leak, and the photo settling in. It uses Tony laughing against a
vignetted blue backdrop (`tk-dc-0-8`, previously unplaced; it replaced the car-park portrait
`extra-d64ac0c2`, now unplaced, on 2026-09-26), with noir gradients at the head for the wordmark
and at the foot for the site line ("Six decades in film, / *put to work* / for you.")
and three career figures stated in the About copy. The stage is sticky, and it sits in the
layout, so moving between sign-in, sign-up and reset changes only the form. On phones and
tablets it collapses to a short band holding the wordmark, so the form starts above the fold.
The form column carries nothing else: a plain eyebrow label per screen ("Sign in",
"Reset"…) led by a small clapperboard mark, the title at the auth size (§9.1), the form, and the alternate action as a
full-width link panel. Password fields use `PasswordInput`, which has a reveal toggle
(`aria-pressed`) and a Caps Lock warning. The sign-in method switch is a WAI-ARIA tablist
with arrow-key support and a sliding thumb. "Check your inbox" outcomes are an
`AuthNotice` panel (`role="status"`), not a one-line alert.

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
| 2026-09-24 | **§8 body face trial: Manrope → Poppins.** At the user's request, to evaluate the look. `--font-body` unchanged; five static weights loaded (Poppins is not variable). Revert = restore Manrope in `layout.tsx`. |
| 2026-09-24 | **§42.2: footer made compact.** The owner found the end-credits footer too long, with its closing slogan and "Stay in touch" block reading as generic. It's now one band: the mark, a line and a single-field newsletter, beside three curated columns, then a smaller signature and the legal line. About 540px tall at desktop width. |
| 2026-09-24 | **§42.2 (new): masthead and end credits.** The header and footer had read as generic. The header is now a monogram and wordmark, navigation in tracked capitals, ink dropdown panels with section descriptions, a cart icon and Sign in as the one filled button (a Book coaching CTA was tried and removed at the owner's direction), with separate phone, tablet and desktop arrangements. The mobile menu is a full-screen ink takeover with numbered display-face sections. The footer is an "end credits" ink band with a closing line and CTAs, the newsletter, credit columns and the name set across the full width. There's a new `.on-ink` token scope. |
| 2026-09-24 | **§42.1: shape decides layout.** Landscape artwork no longer loses 40–64% to the portrait frame. On the wall it is a two-column background-image "still" with the text over it. A landscape spotlight becomes a banner. Work pages show artwork uncropped at its true ratio. Needs `resources.width/height` (note 08, migration 0011). |
| 2026-09-24 | **§42.1 (new): the catalogue redesigned as a studio slate.** The catalogue read as a blog of cards. The hub, category and work pages now open on a screening-room hero (ink, grain, very large display type, the work's own covers fanned and blurred). The hub is a numbered index. A category is a spotlight followed by a poster wall with no card chrome. A work page is a title card, a reading column and a filmstrip, with previous/next navigation. `WorkCard` was rebuilt as a bare poster, so the home page's strip follows the same design. No new tokens: it uses `secondary`, `secondary-foreground` and the `onBlock` button variants, all already contrast-checked. |
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
| 2026-09-24 | **Home page redesign.** §5: a fourth block, `--block-noir` (`#0F1513`), sampled from the hero photo's backdrop and reserved for the home hero; contrast pair added (16.70:1). §37: the hero entrance and a new credits `Marquee` are CSS keyframes with no JS; `HeroCanvas` and the `three` dependency removed. §42.3: new "dissolved hero" format; the home hero now uses the black-backdrop portrait, and the yellow portrait it replaced moved to the Give-Get-Go header, so the two yellow heroes are now About and Give-Get-Go. The home "Something for everyone" card grid was folded into the coaching band as a numbered index. |
| 2026-09-24 | **Home page, second pass, and the carousel rule.** §37: new shared `Carousel` (timer-driven, prev/pause/next, scroll-snap) is the only slider pattern, at the owner's direction that sliders move by themselves and never with page scroll; `ScrollPan` and the `gsap` dependency removed, so the project now has no animation library. §11: `Band` gains `spacing="roomy"` for pages built as a few large statements. §42.3: `PhotoSplit` gains `split="text"` (5:7, words weighted) for About Tony. Home now reads its coaching price list live from the storefront tables (tiers, series, courses, cohorts, one-to-one services, retreats) so it cannot quote a price the checkout contradicts, and adds a career timeline built from catalogue-stated dates. |
| 2026-09-24 | **Fewer colours, one heading scale.** §5: public fields reduced to teal and noir (`Band` no longer offers oxblood or indigo; About band and Give-Get-Go tiles moved to noir/teal); oxblood and indigo kept only for the Account/Admin identity strips. §9.1: `--text-h1`/`--text-h2` set on the elements in the base layer, size classes stripped from every public h1/h2, card and panel titles demoted to h3; home hero on `--text-display`. §37: `LoopingStrip` for the continuously moving home catalogue. Home order is now catalogue → coaching → testimonials, and the hero credits line sits just below the full-screen title card. |
| 2026-09-24 | §42.3: photo credit moved to the bottom right everywhere and made smaller (10px, faint chip on overlays) so it no longer competes with page text; the banner and home-hero credits left the text column. Home "Six decades" banner now follows the career timeline. |
| 2026-09-24 | §11: default content width widened from 72rem to 80rem (1280px), deliberately still inset from the 90rem header/footer; banner text now aligns to the content column. Width table recorded. |
| 2026-09-24 | §11: content column settled at 76rem (1216px) — the owner found 80rem too wide and 72rem too narrow. |

| 2026-09-24 | §5: **teal removed from the site** (owner). `--block-teal` deleted; `--accent` now the site red in both themes; Academy strip and band noir; home coaching section on the paper tone (`surface-muted`), closing section and Give-Get-Go tiles noir; light `--secondary` set to noir so the footer, menus and screening room match the one colour field. §42.3: About Tony split photo widened to take a third of the gap beside the text (words unmoved). |
| 2026-09-24 | §37: carousels show whole slides only — slides sized as fractions of the row, never fixed widths; applied to the home timeline (1 / 2 / 3 per view). |
| 2026-09-24 | §9.1: home hero headline fixed at three lines, non-wrapping; phone size follows viewport width so the first line fits whole. |
| 2026-09-24 | Home, third pass: "Six decades" rebuilt as a 3:2 full-bleed feature pinned to the photo top (no head crop, no parallax overshoot) with a decade ruler; `PhotoSplit split="text"` drops parallax for the same reason. Coaching gains three room facts, a tier ladder and series chips, and rows that lift onto a card on hover. Testimonials become one large quote at a time in the shared `Carousel`. Closing becomes three numbered columns. |
| 2026-09-25 | **Contact redesigned** (owner). A noir title card with the cap portrait dissolved into the field (was a `PhotoBanner`), words at `--hero-text-top`. The form is one centred card under a "Write to Tony" heading, with underlined fields, small-caps labels, a live message counter, and a shaded footer holding Turnstile and Send. It keeps its normal scroll, nothing sticky. After sending, a "Thank you." confirmation with onward links. Channels become an editorial index with monochrome logos (`ChannelIcon`) and each URL. No server or schema change. |
| 2026-09-25 | §37, §42: **Blog redesigned** as an editorial index and reading room. `HoverPreview` and the scroll-timeline reading-progress bar added to the motion table. New `Prose` component (drop cap via `.drop-cap`, end mark, bare URLs linked) renders plain-text bodies through `lib/content/prose.ts`, which handles the archive's soft-wrapped lines and blank-with-spaces paragraph breaks. |
| 2026-09-25 | §37: `HoverPreview` removed with the blog's numbered index (owner asked for cards). The blog hero is centred — title parted around an arched portrait — because the words-beside-photo split had become every page's opening (owner). |
| 2026-09-25 | §37, §42.1: **Catalogue redesigned on owner feedback.** Hub opens on `PosterWall` (every poster drifting behind a centred title, with a Pause motion control) then collection cards with fanned works; the hub no longer lists works or empty collections. Category pages use a centred `ScreeningHero` with the fan overlapping into the page; the spotlight is gone. All catalogue numbering and counts removed. |
| 2026-09-25 | §42.3: the catalogue hub's closing `PhotoBanner` ("The man behind the work") removed at the owner's request — disconnected from the page and redundant with the menu and footer links to About. Its photo (`tk-dc-0-33`, yellow) is unplaced and free for another page. |
| 2026-09-25 | §42.1: every collection now has a hub card; Audio and Interviews, with nothing published, show as unlinked "Coming soon" cards (owner). |
| 2026-09-25 | §42.1: `AudioPlayer` added for hosted interview and podcast recordings. A drawn `GeneratedCover` on a work card no longer repeats the title printed beneath it; it carries the collection name. |
| 2026-09-25 | §42.1: square show artwork in podcasts, interviews and audio shown uncropped inside the 3:4 poster frame over a blurred copy of itself; books and films unchanged. |
| 2026-09-25 | §42.1: whole-artwork rule extended to landscape covers in podcasts, interviews and audio, centralised as `showsWhole()` / `wallForm()`; Watch keeps full-width stills. |
| 2026-09-25 | §42.1: collection walls moved into `WorkWall`; a partly filled last row is centred at the grid's column widths instead of ending flush left. |
| 2026-09-25 | §42.1: collection walls show five columns from `lg` (desktop and above), four from `md`, two on phones; a collection that five would leave with a mid-grid gap keeps four. The centred last row is worked out for each column count. |
| 2026-09-26 | §42.1: media works awaiting a link are shown with their cover and a "Coming soon" label, unlinked (`awaitingLink()`). |
| 2026-09-26 | **Coaching overview rebuilt** (owner): full-bleed hero, offer cards without numbering, How it works on noir (merged from the removed `/coaching/about`), a membership staircase, filmed and written testimonials. `coachingBanner` unplaced; the `Testimonials` component deleted. |
| 2026-09-26 | Coaching overview below the hero redone (owner: congested, disliked): chapters per way of working with photos, a programme-style How it works, equal membership cards, and filmed and written testimonials as carousels. `Carousel` now stops autoplay on a `media:play` event from inside a slide. |
| 2026-09-26 | Coaching listing pages: hero photos removed; every offer gets a photographic cover of its subject (CC0, StockSnap); `OfferGrid` sizes the grid by count, with a feature card for a lone offer; figure tiles removed. Overview spacing settled at `py-20 sm:py-24` with modest chapter photos. |
| 2026-09-26 | Coaching overview: Ways in reduced to one row of three compact cards; Membership and the closing section moved off the paper tone onto the page ground (owner). |
| 2026-09-26 | Eyebrows site-wide: red removed from the label text; red kept as the dash (both sides when centred). New shared `Eyebrow` component; `PageHeader` and 13 pages moved onto it. |
| 2026-09-26 | Courses: How to Get Your Movie Made leads. On /coaching/courses it takes the wider share of the row (`OfferGrid lead`, 3:2), the level is the card eyebrow, and a line notes that Level One is not a prerequisite. The overview names it under On your own. |
| 2026-09-26 | `OfferCard` redesigned as a ticket: a photo with a red price tag, a noir body and equal heights. Group Coaching moved onto it, with prices. The wider lead-card option was removed (owner: equal sizes). New course covers. |
| 2026-09-26 | Bullets on group coaching curricula and membership cards: white instead of red. The Memberships page's closing photo banner ("Every tier includes everything below it.") was removed; the `memberships` design photo is unplaced. "(Silver/Gold/Platinum Level)" was dropped from cohort descriptions. |
| 2026-09-26 | Membership cards: benefit bullets replaced by teal check marks in soft discs; the billing term moved out of the list as a muted line. |
| 2026-09-26 | Coaching product detail pages rebuilt on shared `ProductPage` parts: a cover hero with the price tag, a facts row, a sticky purchase panel, check lists and a mobile buy bar. The retreat detail route is still missing. |
| 2026-09-26 | Type trial in /coaching: the display serif is kept for headings and prices only; small and reading text moved to the body face. |
| 2026-09-26 | `ProductHero`: text is top-aligned, with the eyebrow at `--hero-text-top` (measured equal to other pages: 153px at 1440×900, 160px at 1920×1200) and the back link above it; the gradient now darkens from the top. |
| 2026-09-26 | `ProductHero` (owner): the back link stays in place but is now a larger bordered pill; the eyebrow and title moved 2rem lower, below `--hero-text-top`; the hero now fills the screen below the header less 2rem (capped at 60rem), up from 64svh. |
| 2026-09-26 | Testimonials never use the display serif (owner): the home carousel, the testimonials page lead quote and the About closing quote are all in the body face, medium weight. |
| 2026-09-26 | `Carousel` gains `fitHeight` (one-slide carousels): the strip takes the height of the slide in view and eases to the next. Home testimonials use it: quotes a quarter smaller (18px / 27px), line height 1.35–1.4, a minimum slide height, growing only for long quotes (owner). |
| 2026-09-26 | Home testimonials carousel: quotes back in the display serif (semibold), reversing the type rule there only, and all set at one size (24px / 36px from `sm`) rather than stepping down with length (owner). Home coaching section cut down: no photo, no problem list or figures, a heading and one line, then a tighter offer table with course titles only (owner: too big/long). |
| 2026-09-26 | `/about` gains content from the old main and coaching sites' biography pages (owner): a fuller hero intro, the crew ladder and early credits, the full credits list and nine more names in the 1970s chapter (with the *Riding High* cover), the writing beyond the books, and a new "In his own words" section after the chapters quoting Tony verbatim. Nothing new is claimed beyond those pages. |
| 2026-09-26 | `/about/testimonials` header redesigned (owner) as a noir screening room: the Q&A photo whole and centred with dissolved edges, the words centred on its dark foot, flowing into the noir lead quote. Replaces the arched split. |
| 2026-09-26 | `/about/testimonials` header decluttered (owner): the pinned quote, the outer hairline arch and the three count figures removed; the words and the arched photo remain. |
| 2026-09-26 | `/about/testimonials` "Every voice": the three-column masonry wall became the shared `Carousel`, two cards per view from `md` and one on phones; the filter tabs are unchanged (owner: too clustered). |
| 2026-09-26 | `ProductFacts` labels lightened (owner: they competed with the values): regular weight and slightly smaller, in the full muted grey. A 75% grey was tried and rejected at 3.7:1 contrast. Measured 6.7:1 in light and 9.6:1 in dark. |
| 2026-09-26 | Display serif limited to headings and prices **site-wide** (extending the coaching trial). **Page titles:** only the home page keeps the title-card size. About, Contact, Catalogue and Give-Get-Go drop `.title-card`, and the blog's split title uses `--text-h1`. `globals.css` records the rule. |
| 2026-09-26 | **Size ceiling: no text that is not a heading may be larger than the section h2** (owner: some About text was bigger than the h1). Chapter numerals, stat figures, quote glyphs and testimonial figures use `clamp(1.75rem,1.25rem+1.5vw,2.75rem)`, which tracks 0.25rem under the h2 at every width. The About statement and the testimonials lead quote are capped at `--text-h2`, and the hero subtitles on About and Contact and the About chapter leads are 22–26px. Audited at 1440, 1100, 768 and 390 px. The Contact subtitle is wider (`max-w-2xl`). **Spacing:** new `Band spacing="balanced"` (three quarters of roomy); home sections 4–9 and every Testimonials section are cut by a quarter. |
| 2026-09-26 | About: the pull quote (Francesca Lilleystone) is back in the display serif, an owner-requested exception to the serif-for-headings-and-prices rule. The hero subtitle is 532px wide so "educator." stays on line one; the paragraph under it is 460px. The worked-with names list is at lead size (18–20px), about a third shorter. |
| 2026-09-26 | About: the pull quote uses the testimonials lead quote's face and weight at 24–30px (at the h2 size the long quote ran to eight lines). The Recognition band spacing is `balanced` (a quarter less), with a 3rem gap to the medallions. |
| 2026-09-26 | Home coaching section redesigned as a short signpost (owner): heading, one line and Explore button, then the six offers as a plain list with no cards (owner) — each offer on its own top rule led by a short red stroke (drawing full width on hover), with clear space between offers so they do not read as mixed; title, one-line summary, live "from" price beneath; three columns from `lg`, two from `sm` — on the paper tone (`surface-muted`), so the section parts from the noir catalogue above and the testimonials below (owner asked for a separate background). The offer table's tier ladder, series chips, detail lists and row numbers were removed — the detail lives on /coaching. Section height ≈680px desktop (was ≈1,270px). |
| 2026-09-26 | `/about/testimonials`: the noir lead quote band is removed (owner: the slider below already shows every voice; its quote joins the slider and the count reads "11 voices"). The header now fills the screen below the masthead, with the Q&A photo at full header height over a blurred copy of itself, and the words on its dark foot. |
| 2026-09-26 | **Events and legal pages redesigned** (owner: award-winning, production ready). `/events`: a noir title band with a pool of light (no photo) and a "Next" pill, the soonest event as a wide billing, later events in a row, past events as an archive, most recent first; each shows its cover photo, or a noir date leaf when it has none. `/events/[slug]` uses the shared product page (hero, facts, reading column, gallery of event photos, a registration panel for every state). `ProductHero` without a cover now sizes to its words on grain and light instead of a near-full screen of empty noir. `/privacy`, `/terms`, `/cookies` share a new `LegalDocument` layout: noir title band, "In short" summary, sticky contents from `lg`, unnumbered sections, a contact block, links to the other policies. |

## Workspace type scale (2026-09-26, owner)

Account and the signed-in Academy are app screens, not editorial pages, and use one standard
app scale instead of the public site's display serif at poster size. Everything inside
`<main className="workspace">` in those two layouts takes:

- the body face (Poppins) for every heading and for anything marked `font-display`;
- page `h1` ≈ 28–32px (`clamp(1.75rem, 1.5rem + 0.75vw, 2rem)`), section `h2` 20px;
- no scroll-reveal: dashboard sections render immediately.

Set once in `globals.css` (`.workspace`), not per page. The family rule is unlayered so it
beats the `font-display` utility; sizes sit in `base`, so an explicit size utility still wins.
The brand stays in the `WorkspaceHeader` wordmark, outside `.workspace`. **This is a deliberate
exception** to the site-wide rules "serif for headings" and "no size classes on h1/h2" (which
continue to govern public pages). Admin is not included.

**Extended to Admin, 2026-09-27.** Admin's `<main>` now carries `.workspace` too: its pages
used `PageHeader`, which set every title in the display serif pushed down to the public hero
height — a poster over a table. Admin pages use `AdminPageHeader` (components/admin/AdminUI),
the Admin counterpart of `AccountHeader`, whose title starts level with the first sidebar item
(note 04 §32.2).

## Workspace iconography (2026-09-27, owner)

Account, Academy and Admin use ONE icon set, `components/ui/Icon.tsx`: 24px grid, 1.7 stroke,
round caps and joins — the style the workspace navigations already drew. `IconTile` puts an
icon in a round tile whose tone carries state (accent = this/current, success = on, warning =
needs attention, error = failing, neutral = none). Used on section cards (`AccountCard icon`,
the Security page's cards), rows (keys, devices, integrations, orders), stat cards, access
cards, shortcuts and workspace empty states (`EmptyState icon`, opt-in — public pages leave it
out). Icons are decorative (`aria-hidden`); words always carry the meaning.

**Alignment rule (owner).** Content under a heading that has a leading icon starts where the
heading's TEXT starts, never under the icon: the body is padded by tile + gap (`sm:pl-16` for a
large tile, `pl-11` small, `pl-13` medium). Where a phone has no room to indent, the tile sits
ABOVE the heading instead. The same holds in navigation trees: a group's pages start at the
group name's text (Admin nav).

