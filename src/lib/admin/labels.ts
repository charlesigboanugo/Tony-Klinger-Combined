/**
 * A stored code as the words staff read — note 10 §32.
 *
 * "group_coaching" becomes "Group coaching". A few codes keep an older name in
 * the database than the site uses: the product is sold as a Coaching Pass
 * (owner, 2026-10-10), but its tables, types and permissions still say
 * `membership`. Renaming those is a migration for no visible gain, so the old
 * word is translated here, the one place every admin list, filter and form
 * turns a code into words.
 */
const RENAMED: Record<string, string> = {
  membership: "Coaching Pass",
  memberships: "Coaching Passes",
  membership_tier: "Coaching Pass tier",
  membership_tiers: "Coaching Pass tiers",
  membership_choices: "Playlist choices",
  member_qa_sessions: "Q&A sessions",
};

export function codeLabel(value: string): string {
  if (RENAMED[value]) return RENAMED[value];
  // The old word inside a longer code too: "membership granted" in the audit
  // log reads "Coaching Pass granted".
  return value
    .replace(/[_-]/g, " ")
    .replace(/\bmemberships\b/gi, "Coaching Passes")
    .replace(/\bmembership\b/gi, "Coaching Pass")
    .replace(/^\w/, (c) => c.toUpperCase());
}
