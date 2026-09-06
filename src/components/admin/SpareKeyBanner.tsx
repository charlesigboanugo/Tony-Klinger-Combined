import Link from "next/link";

/**
 * Prompt for a second security key — note 05 §11.1.
 *
 * A banner rather than a block. The spare key exists to prevent lockout, so
 * refusing access until it is registered would penalise the operator at exactly
 * the moment it is meant to protect them.
 *
 * The owner is the exception: that account cannot be recovered by anyone else,
 * so `requirePermission()` and `assert_admin_action()` both refuse privileged
 * work until it holds two keys.
 */
export function SpareKeyBanner({
  verifiedFactors,
  isOwner,
}: {
  verifiedFactors: number;
  isOwner: boolean;
}) {
  return (
    <div
      role="status"
      className="mb-6 rounded-(--radius) border border-warning bg-warning/10 px-4 py-3 text-sm"
    >
      <p className="font-medium text-warning">
        {isOwner
          ? "Register a second security key to continue"
          : "Add a spare security key"}
      </p>
      <p className="mt-1 text-muted-foreground">
        {isOwner
          ? "Owner accounts can't be recovered by anyone else. With only one key, losing it means direct database access to get back in."
          : `You have ${verifiedFactors} key${verifiedFactors === 1 ? "" : "s"}. A second one turns a lost device from an account recovery into an inconvenience.`}
      </p>
      <Link href="/account/security/mfa" className="mt-2 inline-block underline">
        Register a key
      </Link>
    </div>
  );
}
