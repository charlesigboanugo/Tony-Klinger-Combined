/**
 * Central navigation definitions — note 04 §34.
 *
 * Navigation is data, rendered by reusable components, so a destination is
 * declared once rather than duplicated across headers, footers and menus.
 *
 * This is NOT the security layer (note 04 §23, note 06 §24). Filtering an item
 * out of a menu hides a link; it does not protect the route. Every route still
 * authorizes itself server-side.
 */

export type NavItem = {
  label: string;
  href: string;
  /** Permission required to see this item. Display only — never access control. */
  permission?: string;
  children?: NavItem[];
  /**
   * Leaves this site. Rendered with an `↗` indicator and opened in a new tab
   * with `rel="noopener noreferrer"` (note 11).
   *
   * A visitor should never discover mid-journey that they have left the site.
   * Give-Get-Go Education is a separate venture with its own platform, and the
   * menu has to say so before the click, not after.
   */
  external?: boolean;
  /**
   * One line saying what a section holds. Shown in the masthead's dropdown
   * panel beside the section name (note 10 §42.2), so a visitor reads what is
   * behind a word like "Give-Get-Go" before choosing a link inside it.
   */
  description?: string;
};

/** Public site — note 04 §3, §38. */
/**
 * Primary navigation — note 04 §4, §5, note 11.
 *
 * ORDERED BY IMPORTANCE, not alphabetically and not by when each was built.
 * The sequence tells a visitor what this site is for, in the order they need
 * it:
 *
 *   Coaching      the commercial core — what is actually sold
 *   Catalogue     six decades of work, and the credibility behind the offer
 *   Give-Get-Go   the broader venture the work now sits under
 *   About         who Tony is, read once the work has been seen
 *   Blog          ongoing writing, valuable but rarely the reason for a visit
 *   Contact       conventionally last; people look for it at the end
 *
 * Catalogue precedes Give-Get-Go because Give-Get-Go is a view OVER catalogue
 * content — the fuller collection should be met before the curated grouping.
 *
 * Events is deliberately absent: it is a footer link (§8), so a visitor is not
 * asked to weigh a listings page against the main offer.
 */
export const publicNavigation: NavItem[] = [
  { label: "Home", href: "/" },
  {
    // About is a SECTION, not a page. The team copy alone runs to roughly four
    // times Tony's biography and is about other people, and the testimonials
    // are a data-driven view reused on the home and coaching pages — neither
    // belongs inlined in a biography (note 03 §5).
    label: "About",
    href: "/about",
    description: "Six decades in film, from The Avengers to Get Carter's legacy.",
    children: [
      { label: "Tony's Story", href: "/about" },
      { label: "Testimonials", href: "/about/testimonials" },
    ],
  },
  {
    label: "Catalogue",
    href: "/catalogue",
    description: "The work itself: films produced and directed, books written, and stories from the front line.",
    // The seven canonical categories — note 03 §7. Individual works are detail
    // pages inside a category, never menu items (note 04 §4).
    children: [
      { label: "All Works", href: "/catalogue" },
      { label: "Books", href: "/catalogue/books" },
      { label: "Films", href: "/catalogue/films" },
      { label: "Audio", href: "/catalogue/audio" },
      { label: "Interviews", href: "/catalogue/interviews" },
      {
        label: "Stories From The Front Line",
        href: "/catalogue/stories-from-the-front-line",
      },
      { label: "Podcasts", href: "/catalogue/podcasts" },
      { label: "Watch", href: "/catalogue/watch" },
    ],
  },
  {
    label: "Coaching",
    href: "/coaching",
    description: "Learn the film business from someone who has done it — courses, cohorts, group and one-to-one coaching.",
    children: [
      // The trigger is a BUTTON that toggles the menu, so it cannot navigate.
      // Without an entry pointing at the section's own landing page, that page
      // is unreachable from the desktop nav entirely (note 04 §21).
      { label: "Coaching Overview", href: "/coaching" },
      { label: "Memberships", href: "/coaching/memberships" },
      { label: "Courses", href: "/coaching/courses" },
      { label: "Group Coaching", href: "/coaching/group-coaching" },
      { label: "Cohorts", href: "/coaching/cohorts" },
      { label: "Private Coaching", href: "/coaching/private-coaching" },
      { label: "Retreats", href: "/coaching/retreats" },
    ],
  },
  {
    // Note 11: Tony's broader venture — publishing, films and documentaries.
    // A navigation and content GROUPING over existing catalogue content, not a
    // separate application and not duplicated content. One page since
    // 2026-09-25 (owner): Publishing, Films and Documentaries are sections of
    // /give-get-go, so the menu is that page and the external Education site.
    label: "Give-Get-Go",
    href: "/give-get-go",
    description: "Tony's venture for publishing, films and documentaries, and its education arm.",
    children: [
      { label: "Publishing, Films & Documentaries", href: "/give-get-go" },
      {
        // A RELATED VENTURE, not a section of this site and explicitly not part
        // of the Academy (note 11). Its own CIC, its own platform.
        label: "Give-Get-Go Education",
        href: "https://give-get-go.com",
        external: true,
      },
    ],
  },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

/**
 * Footer link columns — note 04 §8, note 10 §42.2.
 *
 * CURATED, not the whole menu. The footer used to repeat every submenu entry,
 * which made it a second sitemap and most of the page's height; it now carries
 * the destinations people actually look for at the foot of a page. The full
 * set stays in the masthead. Legal routes are separate (note 03 §8.2).
 */
export const footerColumns: { title: string; links: NavItem[] }[] = [
  {
    title: "The work",
    links: [
      { label: "Films", href: "/catalogue/films" },
      { label: "Books", href: "/catalogue/books" },
      { label: "Front Line stories", href: "/catalogue/stories-from-the-front-line" },
      { label: "All works", href: "/catalogue" },
    ],
  },
  {
    title: "Coaching",
    links: [
      { label: "Overview", href: "/coaching" },
      { label: "Memberships", href: "/coaching/memberships" },
      { label: "Courses", href: "/coaching/courses" },
      { label: "Private coaching", href: "/coaching/private-coaching" },
    ],
  },
  {
    title: "Studio",
    links: [
      { label: "About Tony", href: "/about" },
      { label: "Give-Get-Go", href: "/give-get-go" },
      { label: "Blog", href: "/blog" },
      { label: "Events", href: "/events" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

/** Legal routes — note 03 §8.2. Always in the footer's bottom line. */
export const legalNavigation: NavItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Cookies", href: "/cookies" },
];

/**
 * Academy workspace — note 04 §9.
 *
 * Four items, at the user's direction (2026-09-05), reversing the earlier
 * seven-item baseline:
 *
 *   Masterclasses  folded conceptually into Courses rather than kept as a
 *                  separate destination — the two were the same kind of
 *                  thing wearing different labels.
 *   Resources      no area of its own. A resource is delivered as part of
 *                  the course, cohort or coaching session it belongs to,
 *                  the same rule note 07 §23 already applied to recordings.
 *   Calendar       redundant with Bookings, which already lists everything
 *                  booked and its date — a second page answering the same
 *                  question is upkeep with no distinct use.
 *
 * Recordings were already absent for the same reason as Resources: reached
 * through their parent experience (note 07 §23), never a destination.
 */
export const academyNavigation: NavItem[] = [
  { label: "Dashboard", href: "/academy" },
  { label: "Courses", href: "/academy/courses" },
  { label: "Cohorts", href: "/academy/cohorts" },
  { label: "Coaching", href: "/academy/coaching" },
];

/**
 * Customer account — note 04 §12, §31.
 *
 * One flat list, like the Academy's (owner, 2026-09-26: no group headings),
 * ordered by the question someone arrives with: what do I have, what have I
 * paid, then my details. "Entitlements" is labelled "Your access" — customers
 * do not say "entitlement"; the route is unchanged.
 */
export const accountNavigation: NavItem[] = [
  { label: "Overview", href: "/account" },
  { label: "Your access", href: "/account/entitlements" },
  { label: "Bookings", href: "/account/bookings" },
  { label: "Memberships", href: "/account/memberships" },
  { label: "Orders", href: "/account/orders" },
  { label: "Billing", href: "/account/billing" },
  { label: "Profile", href: "/account/profile" },
  { label: "Security", href: "/account/security" },
  { label: "Notifications", href: "/account/notifications" },
  { label: "Settings", href: "/account/settings" },
];

export type NavGroup = { label: string; items: NavItem[] };

/** Admin workspace, grouped — note 04 §14, §15.
 *  `permission` drives visibility only; the route enforces it (note 06 §24). */
export const adminNavigation: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/admin" }],
  },
  {
    // "People", not "Customers": this group also holds staff roles and the
    // team, and a heading that describes only a third of its items is the
    // confusion the owner flagged (2026-09-27).
    label: "People",
    items: [
      { label: "Users", href: "/admin/users", permission: "users.read" },
      { label: "Roles", href: "/admin/roles", permission: "roles.read" },
      { label: "Team", href: "/admin/team", permission: "users.read" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Products", href: "/admin/products", permission: "products.read" },
      { label: "Prices", href: "/admin/prices", permission: "products.read" },
      { label: "Memberships", href: "/admin/memberships", permission: "memberships.read" },
      { label: "Entitlements", href: "/admin/entitlements", permission: "entitlements.read" },
      { label: "Orders", href: "/admin/orders", permission: "orders.read" },
      { label: "Payments", href: "/admin/payments", permission: "payments.read" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Blog", href: "/admin/blog", permission: "blog.read" },
      { label: "Catalogue", href: "/admin/catalogue", permission: "catalogue.read" },
      { label: "Media", href: "/admin/media", permission: "catalogue.read" },
      { label: "Testimonials", href: "/admin/testimonials", permission: "blog.read" },
      // Had a full editor (resources.ts) but no way in except typing the URL.
      { label: "Testimonial videos", href: "/admin/testimonial-videos", permission: "blog.read" },
    ],
  },
  {
    label: "Learning",
    items: [
      { label: "Courses", href: "/admin/courses", permission: "courses.read" },
      // A course is a shell until it has modules, and a module is a shell until
      // it has lessons — so the two tables that hold the actual teaching sit
      // beside it rather than being reachable only by typing a URL.
      { label: "Modules", href: "/admin/modules", permission: "courses.read" },
      { label: "Lessons", href: "/admin/lessons", permission: "courses.read" },
      { label: "Cohorts", href: "/admin/cohorts", permission: "cohorts.read" },
      { label: "Workshops", href: "/admin/workshops", permission: "cohorts.read" },
      { label: "Group Coaching", href: "/admin/group-coaching", permission: "coaching.read" },
      { label: "Sessions", href: "/admin/sessions", permission: "coaching.read" },
      { label: "Masterclasses", href: "/admin/masterclasses", permission: "masterclasses.read" },
    ],
  },
  {
    label: "Experiences",
    items: [
      { label: "Private Coaching", href: "/admin/private-coaching", permission: "coaching.read" },
      { label: "Coaching times", href: "/admin/coaching-slots", permission: "coaching.read" },
      { label: "Retreats", href: "/admin/retreats", permission: "retreats.read" },
      { label: "Events", href: "/admin/events", permission: "events.read" },
      { label: "Event photos", href: "/admin/event-photos", permission: "events.read" },
      // Event day: attendee lists, the door scan and the online joining link.
      { label: "Check-in", href: "/admin/check-in", permission: "events.read" },
      { label: "Bookings", href: "/admin/bookings", permission: "bookings.read" },
    ],
  },
  {
    label: "Communications",
    items: [
      // Contact-form messages. RLS lets `users.read` read them (migration 0005).
      { label: "Enquiries", href: "/admin/enquiries", permission: "users.read" },
      { label: "Emails", href: "/admin/emails", permission: "emails.read" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", href: "/admin/settings", permission: "settings.read" },
      { label: "Audit log", href: "/admin/audit", permission: "audit.read" },
    ],
  },
];

/**
 * Active-state matching for nested routes — note 04 §24.
 *
 * PREFIX matching, deliberately: on /academy/courses/my-course the Courses item
 * must still read as active, which is what §24 requires.
 *
 * FOR VISUAL HIGHLIGHTING ONLY. Do not use this for `aria-current="page"` —
 * see `isCurrentPage`.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Exact match, for `aria-current="page"`.
 *
 * ARIA defines `aria-current="page"` as "the current page within a set of
 * pages" — it identifies ONE element. Using `isActive` for it marks every
 * ancestor as well, so on /about/team a screen reader hears the About link
 * announced as the current page too, and on /admin/entitlements/{id} it hears
 * the index announced as current. Both are false.
 *
 * The visual treatment still uses `isActive`, because being inside a section
 * and being on its page are different facts and the interface should show the
 * first while announcing only the second.
 *
 * A section TRIGGER — a button that opens a submenu — is not a destination at
 * all and takes `aria-current="true"` ("current item within a set") at most,
 * never "page".
 */
export function isCurrentPage(pathname: string, href: string): boolean {
  return pathname === href;
}
