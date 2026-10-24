import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { timeAgo } from "@/lib/utils/device";

/**
 * Admin queries — note 06 §14, §16.
 *
 * These use the service-role client because an operator legitimately reads
 * across all customers, which RLS deliberately prevents for ordinary sessions.
 *
 * That makes the CALLER responsible for authorization: every page using these
 * must have passed `requirePermission()` first (note 06 §2, note 08 §61). The
 * database is not the backstop here, so the route must be.
 */

export type AdminUserRow = {
  user_id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
  email: string | null;
  /** When the account last signed in (not when it was last active); null if never. */
  lastSignInAt: string | null;
  /** The same in words, "2 days ago"; null if never. */
  lastSignInAgo: string | null;
  /** Roles held; empty for a customer. */
  roles: string[];
  /** Holds a role that makes them staff (migration 0019: not every role does). */
  staff: boolean;
};

/** Rows per request, and how many requests at most: 5,000 accounts. */
const PAGE = 1000;
const MAX_PAGES = 5;

/**
 * Every account, with its email, last sign-in and roles — note 06 §14.
 *
 * THE WHOLE DIRECTORY IN THREE REQUESTS, so the Users page can search, narrow
 * and sort across everybody rather than across whichever hundred it loaded.
 *
 * An email and a sign-in time live in `auth.users`, which PostgREST does not
 * expose and cannot join. The list used to work around that by asking for
 * each account one at a time (a hundred requests a page) and could search
 * names only. Supabase's admin API lists accounts a thousand at a time, so one
 * call brings back every email and sign-in time, read alongside the profiles
 * and the role assignments.
 *
 * `complete` is false if there are more accounts than `PAGE * MAX_PAGES`. At
 * that size this should become a search in the database; the page says so
 * rather than quietly searching a part.
 */
export async function adminUserDirectory(): Promise<{ users: AdminUserRow[]; complete: boolean }> {
  const admin = createAdminClient();

  async function authUsers() {
    const all: Array<{ id: string; email?: string; last_sign_in_at?: string }> = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
      const batch = data?.users ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  }

  async function profiles() {
    const all: Array<Omit<AdminUserRow, "email" | "lastSignInAt" | "lastSignInAgo" | "roles" | "staff">> = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data } = await admin
        .from("profiles")
        .select("user_id,display_name,first_name,last_name,status,created_at")
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      const batch = data ?? [];
      all.push(...batch);
      if (batch.length < PAGE) break;
    }
    return all;
  }

  const [accounts, people, { data: roleRows }] = await Promise.all([
    authUsers(),
    profiles(),
    admin.from("user_roles").select("user_id,roles(name,is_staff)"),
  ]);

  const accountOf = new Map(accounts.map((a) => [a.id, a]));
  const rolesOf = new Map<string, string[]>();
  const staff = new Set<string>();
  for (const row of (roleRows ?? []) as unknown as Array<{ user_id: string; roles: { name: string; is_staff: boolean } | null }>) {
    if (!row.roles) continue;
    rolesOf.set(row.user_id, [...(rolesOf.get(row.user_id) ?? []), row.roles.name]);
    if (row.roles.is_staff) staff.add(row.user_id);
  }

  const now = Date.now();
  return {
    complete: people.length < PAGE * MAX_PAGES,
    users: people.map((p) => {
      const account = accountOf.get(p.user_id);
      return {
        ...p,
        email: account?.email ?? null,
        lastSignInAt: account?.last_sign_in_at ?? null,
        lastSignInAgo: timeAgo(account?.last_sign_in_at, now, "always"),
        roles: rolesOf.get(p.user_id) ?? [],
        staff: staff.has(p.user_id),
      };
    }),
  };
}

export async function adminUserDetail(userId: string) {
  const admin = createAdminClient();

  const [profile, roles, entitlements, orders] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role_id,roles(name)").eq("user_id", userId),
    admin
      .from("entitlements")
      .select("id,resource_type,resource_id,source_type,source_id,status,quantity,quantity_used,expires_at,grant_reason")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("orders")
      .select("id,status,total,currency,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    profile: profile.data as Record<string, unknown> | null,
    roles: ((roles.data ?? []) as unknown as Array<{ roles: { name: string } | null }>)
      .map((r) => r.roles?.name)
      .filter(Boolean) as string[],
    entitlements: (entitlements.data ?? []) as Array<{
      id: string;
      resource_type: string;
      resource_id: string | null;
      source_type: string;
      source_id: string | null;
      status: string;
      quantity: number | null;
      quantity_used: number;
      expires_at: string | null;
      grant_reason: string | null;
    }>,
    orders: (orders.data ?? []) as Array<{
      id: string;
      status: string;
      total: number;
      currency: string;
      created_at: string;
    }>,
  };
}

export async function adminOrders(limit = 100) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id,user_id,guest_email,status,total,currency,created_at,paid_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Array<{
    id: string;
    user_id: string | null;
    guest_email: string | null;
    status: string;
    total: number;
    currency: string;
    created_at: string;
    paid_at: string | null;
  }>;
}

export async function adminContent(table: "blog_posts" | "catalogue_items") {
  const admin = createAdminClient();
  const columns =
    table === "blog_posts"
      ? "id,title,slug,status,published_at,created_at"
      : "id,title,slug,category,status,published_at,is_external,created_at";

  const { data } = await admin
    .from(table)
    .select(columns)
    .order("created_at", { ascending: false });

  return (data ?? []) as unknown as Array<Record<string, unknown>>;
}

export async function adminAuditLog(limit = 100) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("audit_logs")
    .select("id,actor_user_id,action,resource_type,resource_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Array<{
    id: string;
    actor_user_id: string | null;
    action: string;
    resource_type: string | null;
    resource_id: string | null;
    reason: string | null;
    created_at: string;
  }>;
}

export async function adminCounts() {
  const admin = createAdminClient();
  const tables = ["profiles", "orders", "entitlements", "bookings"] as const;

  const counts = await Promise.all(
    tables.map((t) =>
      admin.from(t).select("*", { count: "exact", head: true }).then((r) => r.count ?? 0),
    ),
  );

  return Object.fromEntries(tables.map((t, i) => [t, counts[i]])) as Record<
    (typeof tables)[number],
    number
  >;
}

/**
 * Every role, its permissions, and who holds it — note 06 §7, §10, §39.
 *
 * The roles area was permission-checked and empty. An operator could not answer
 * the two questions the page exists for: what does this role allow, and who
 * currently has it? Both are read straight from `roles`, `role_permissions`
 * and `user_roles` rather than from any hard-coded list, so a role added in a
 * migration appears here without a code change (note 06 §39).
 */
export type RoleOverview = {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  holders: { userId: string; name: string }[];
};

export async function adminRoles(): Promise<RoleOverview[]> {
  const admin = createAdminClient();

  const [rolesRes, rolePermsRes, userRolesRes, profilesRes] = await Promise.all([
    admin.from("roles").select("id,name,description").order("name"),
    admin.from("role_permissions").select("role_id,permissions(name)"),
    admin.from("user_roles").select("user_id,role_id"),
    admin.from("profiles").select("user_id,display_name"),
  ]);

  const roles = (rolesRes.data ?? []) as Array<{
    id: string;
    name: string;
    description: string | null;
  }>;

  const rolePerms = (rolePermsRes.data ?? []) as Array<{
    role_id: string;
    permissions: { name: string } | { name: string }[] | null;
  }>;

  const userRoles = (userRolesRes.data ?? []) as Array<{
    user_id: string;
    role_id: string;
  }>;

  const names = new Map(
    ((profilesRes.data ?? []) as Array<{ user_id: string; display_name: string | null }>)
      .map((p) => [p.user_id, p.display_name?.trim() || "Unnamed account"]),
  );

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    permissions: rolePerms
      .filter((rp) => rp.role_id === role.id)
      .flatMap((rp) => {
        // PostgREST returns a one-to-one embed as an object while the generated
        // types call it an array — normalised the same way everywhere else.
        const p = Array.isArray(rp.permissions) ? rp.permissions[0] : rp.permissions;
        return p?.name ? [p.name] : [];
      })
      .sort(),
    holders: userRoles
      .filter((ur) => ur.role_id === role.id)
      .map((ur) => ({
        userId: ur.user_id,
        name: names.get(ur.user_id) ?? "Unnamed account",
      })),
  }));
}

/**
 * A person's public team entry, and the entries nobody is linked to yet.
 *
 * Both are needed to render one honest control: an operator either creates an
 * entry for this account or connects it to one that already exists. The five
 * seeded biographies are all unlinked, and matching them to accounts by name
 * would be a guess about identity (note 06 §14.1).
 */
export async function adminTeamMembership(userId: string) {
  const admin = createAdminClient();

  const [mine, unlinked] = await Promise.all([
    admin
      .from("team_members")
      .select("id,name,role,slug,status")
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("team_members")
      .select("id,name,role")
      .is("user_id", null)
      .order("position", { ascending: true }),
  ]);

  return {
    entry: mine.data as {
      id: string;
      name: string;
      role: string | null;
      slug: string;
      status: string;
    } | null,
    unlinked: (unlinked.data ?? []) as Array<{
      id: string;
      name: string;
      role: string | null;
    }>,
  };
}

/**
 * The security keys and authenticator apps on an account — note 05 §11.1.
 *
 * Read with the service role because an operator handling a lockout must see
 * what the person has, which their own session cannot show them once they
 * cannot sign in.
 */
export async function adminUserFactors(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });

  return (data?.factors ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      name: factor.friendly_name?.trim() || (factor.factor_type === "totp" ? "Authenticator app" : "Unnamed key"),
      kind: factor.factor_type === "totp" ? ("app" as const) : ("key" as const),
      created_at: factor.created_at,
    }));
}
