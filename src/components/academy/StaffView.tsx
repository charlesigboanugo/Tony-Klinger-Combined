import { Icon, IconTile } from "@/components/ui/Icon";
import { cn } from "@/lib/utils/cn";

/**
 * The Academy's staff view, said plainly — note 06 §23.2.
 *
 * The banner sits above every Academy page for staff who see everything, so
 * nobody (the staff member, or whoever is watching their screen) mistakes it
 * for what a customer sees. `StaffOnly` takes the place of an action a
 * customer would have: a book, register, choose or join button.
 */
export function StaffViewBanner() {
  return (
    <div
      role="note"
      className="mb-8 flex items-start gap-3 rounded-(--radius-lg) border border-accent/35 bg-accent/8 p-4 sm:items-center"
    >
      <IconTile name="eye" tone="accent" size="sm" />
      <p className="text-sm">
        <span className="font-semibold">Staff view.</span>{" "}
        <span className="text-muted-foreground">
          You can see everything in the Academy. Booking, registering and joining live sessions are for customers.
        </span>
      </p>
    </div>
  );
}

export function StaffOnly({
  children = "Staff view",
  onBlock = false,
  className,
}: {
  children?: string;
  onBlock?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-sm",
        onBlock ? "text-block-foreground/75" : "text-muted-foreground",
        className,
      )}
    >
      <Icon name="eye" className="h-4 w-4" />
      {children}
    </span>
  );
}
