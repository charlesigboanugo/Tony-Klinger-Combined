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
    children: [
      { label: "Tony's Story", href: "/about" },
      { label: "Meet the Team", href: "/about/team" },
      { label: "Testimonials", href: "/about/testimonials" },
    ],
  },
  {
    label: "Coaching",
    href: "/coaching",
    children: [
      // The trigger is a BUTTON that toggles the menu, so it cannot navigate.
      // Without an entry pointing at the section's own landing page, that page
      // is unreachable from the desktop nav entirely (note 04 §21).
      { label: "Coaching Overview", href: "/coaching" },
      { label: "About", href: "/coaching/about" },
      { label: "Memberships", href: "/coaching/memberships" },
      { label: "Courses", href: "/coaching/courses" },
      { label: "Group Coaching", href: "/coaching/group-coaching" },
      { label: "Cohorts", href: "/coaching/cohorts" },
      { label: "Private Coaching", href: "/coaching/private-coaching" },
      { label: "Retreats", href: "/coaching/retreats" },
    ],
  },
  {
    label: "Catalogue",
    href: "/catalogue",
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
    // Note 11: Tony's broader venture — publishing, films and documentaries.
    // A navigation and content GROUPING over existing catalogue content, not a
    // separate application and not duplicated content.
    label: "Give-Get-Go",
    href: "/give-get-go",
    children: [
      { label: "Overview", href: "/give-get-go" },
      { label: "Publishing", href: "/give-get-go/publishing" },
      { label: "Films", href: "/give-get-go/films" },
      { label: "Documentaries", href: "/give-get-go/documentaries" },
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

/** Footer secondary links — note 04 §8. */
export const footerNavigation: NavItem[] = [
  { label: "Events", href: "/events" },
  { label: "Contact", href: "/contact" },
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

/** Customer account — note 04 §12. Compact by design. */
export const accountNavigation: NavItem[] = [
  { label: "Overview", href: "/account" },
  { label: "Profile", href: "/account/profile" },
  { label: "Orders", href: "/account/orders" },
  { label: "Memberships", href: "/account/memberships" },
  { label: "Entitlements", href: "/account/entitlements" },
  { label: "Bookings", href: "/account/bookings" },
  { label: "Billing", href: "/account/billing" },
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
    label: "Customers",
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
      { label: "Group Coaching", href: "/admin/group-coaching", permission: "coaching.read" },
      { label: "Masterclasses", href: "/admin/masterclasses", permission: "masterclasses.read" },
    ],
  },
  {
    label: "Experiences",
    items: [
      { label: "Private Coaching", href: "/admin/private-coaching", permission: "coaching.read" },
      { label: "Retreats", href: "/admin/retreats", permission: "retreats.read" },
      { label: "Events", href: "/admin/events", permission: "events.read" },
      { label: "Bookings", href: "/admin/bookings", permission: "bookings.read" },
    ],
  },
  {
    label: "Communications",
    items: [{ label: "Emails", href: "/admin/emails", permission: "emails.read" }],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/admin/settings", permission: "settings.read" }],
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
