import Link from "next/link";

/**
 * "Buying for someone else?" under a buy button — owner, 2026-10-15.
 *
 * Leads to the same checkout in gift mode, where the recipient's email is
 * asked for (lib/commerce/gift). Shown only where what is sold can be a gift.
 */
export function GiftLink({ href, className }: { href: string; className?: string }) {
  return (
    <p className={className ?? "mt-3 text-center text-sm text-muted-foreground"}>
      Buying for someone else?{" "}
      <Link href={href} className="font-medium text-foreground underline underline-offset-4 hover:text-accent">
        Give it as a gift
      </Link>
    </p>
  );
}
