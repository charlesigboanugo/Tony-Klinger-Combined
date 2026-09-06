import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * The user list, optionally filtered — note 06 §14.
 *
 * Searching is over the NAME columns only. An email address lives in
 * `auth.users`, which PostgREST does not expose and which cannot be joined from
 * here, so offering an email search would silently return nothing for the field
 * people would reach for first. The page says which fields it searches rather
 * than leaving that to be discovered.
 */
export async function adminUsers(query?: string, limit = 100) {
  const admin = createAdminClient();

  let request = admin
    .from("profiles")
    .select("user_id,display_name,first_name,last_name,status,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const term = query?.trim();
  if (term) {
    // Commas and parentheses are the separators in PostgREST's `or` grammar, so
    // a search for "Smith, J" would otherwise be parsed as filters rather than
    // matched as text.
    const safe = term.replace(/[(),*]/g, " ").trim();
    if (safe) {
      request = request.or(
        ["display_name", "first_name", "last_name"]
          .map((column) => `${column}.ilike.*${safe}*`)
          .join(","),
      );
    }
  }

  const { data } = await request;

  return (data ?? []) as Array<{
    user_id: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    status: string;
    created_at: string;
  }>;
}

export async function adminUserDetail(userId: string) {
  const admin = createAdminClient();

  const [profile, roles, entitlements, orders] = await Promise.all([
    admin.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("user_roles").select("role_id,roles(name)").eq("user_id", userId),
    admin
      .from("entitlements")
      .select("id,resource_type,source_type,status,quantity,quantity_used,expires_at,grant_reason")
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
      source_type: string;
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

export async function adminEntitlements(limit = 100) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("entitlements")
    .select(
      "id,user_id,resource_type,source_type,status,quantity,quantity_used,expires_at,grant_reason,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as Array<{
    id: string;
    user_id: string;
    resource_type: string;
    source_type: string;
    status: string;
    quantity: number | null;
    quantity_used: number;
    expires_at: string | null;
    grant_reason: string | null;
    created_at: string;
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
 * The security keys on an account — note 05 §11.1.
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
      name: factor.friendly_name?.trim() || "Unnamed key",
      created_at: factor.created_at,
    }));
}
