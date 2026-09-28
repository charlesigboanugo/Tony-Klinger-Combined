/**
 * Shared masthead type and motion — note 10 §42.2. Its own module so the
 * header and the dropdown can both import it without importing each other.
 */

/** The masthead's link type: small, tracked capitals — a studio's letterhead, not a toolbar. */
// Never wraps ("GIVE-GET-GO" broke onto two lines at 1024px); the tracking is
// a touch tighter at `lg`, the narrowest width the full navigation shows at.
export const navLinkType = "text-[0.6875rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase xl:tracking-[0.18em]";

/** Items are spaced px-2 at `lg` and px-3 from `xl`: at exactly 1024px the
 * mark, seven items, the cart and Sign in ran 15px past the screen. */

/** Top-level link underline — a thin bar that grows from the centre rather
 * than a colour swap, so a hover/active state reads as motion, not a flicker.
 * `scale-x` on a compositor-only transform, never `width`. */
export const navLinkUnderline =
  "after:absolute after:inset-x-2 xl:after:inset-x-3 after:bottom-1 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:transition-transform after:duration-(--dur-base) after:ease-expo hover:after:scale-x-100";
