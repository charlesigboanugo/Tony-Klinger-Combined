import "server-only";

import { requireServerEnv } from "@/lib/env/server";

/**
 * Brevo contact and list management — PECR reg 22, UK GDPR.
 *
 * THE BREVO ACCOUNT IS SHARED WITH A LIVE CLIENT PROJECT. `transport.ts`
 * deliberately reaches only the transactional send endpoint so it CANNOT touch
 * contacts at all. This module is the one place that can, and it is constrained
 * in three ways rather than being given free rein:
 *
 *   1. Only the list ids in OUR_LISTS are ever written to. A list id that is
 *      not one of ours is refused, so the client's lists are unreachable even
 *      by a caller that passes the wrong number.
 *   2. Nothing here deletes a contact or a list.
 *   3. `emailBlacklisted` is NEVER sent. Clearing it would resurrect somebody
 *      who unsubscribed.
 *
 * AN UNSUBSCRIBE IN BREVO IS FINAL AND WINS OVER ANYTHING WE WANT TO DO.
 *
 * That is the rule this module exists to enforce. A sync that re-adds a
 * customer because they are still in the `orders` table is how a lawful setup
 * becomes a breach — the person pressed unsubscribe and we put them back.
 * Brevo's documentation does not state whether re-posting a blacklisted contact
 * re-subscribes them, so this does not rely on the answer: the contact's
 * current state is read first, and a blacklisted address is skipped entirely.
 */
const API = "https://api.brevo.com/v3";

export type ManagedList = "newsletter" | "customers" | "members";

const LIST_ENV: Record<ManagedList, string> = {
  newsletter: "BREVO_LIST_NEWSLETTER",
  customers: "BREVO_LIST_CUSTOMERS",
  members: "BREVO_LIST_MEMBERS",
};

/** Configured list ids, or undefined where a list is not set up. */
export function listId(list: ManagedList): number | undefined {
  const raw = process.env[LIST_ENV[list]];
  if (!raw) return undefined;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

/** Every list this module is permitted to write to. */
function ourListIds(): number[] {
  return (["newsletter", "customers", "members"] as const)
    .map((l) => listId(l))
    .filter((id): id is number => id !== undefined);
}

export type ContactResult =
  | { ok: true; skipped?: "unsubscribed" | "not_configured" | "transport_off" }
  | { ok: false; error: string };

/**
 * Contact syncing is opt-in per environment, exactly as sending is.
 *
 * Without EMAIL_TRANSPORT=brevo, nothing here touches the shared account — so a
 * stray `pnpm dev` cannot add a test address to a production list.
 */
function enabled(): boolean {
  return process.env.EMAIL_TRANSPORT?.toLowerCase() === "brevo";
}

async function api(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "api-key": requireServerEnv("BREVO_API_KEY"),
      "content-type": "application/json",
      accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

/**
 * Whether Brevo holds this address as unsubscribed.
 *
 * A 404 means we have never seen them, which is not an unsubscribe. Any other
 * failure returns `true` — FAIL CLOSED: if we cannot establish that somebody
 * wants our email, we do not add them.
 */
async function isUnsubscribed(email: string): Promise<boolean> {
  const { status, body } = await api(`/contacts/${encodeURIComponent(email)}`);

  if (status === 404) return false;
  if (status !== 200) {
    console.warn("brevo contact lookup failed; treating as unsubscribed", { status });
    return true;
  }

  return body.emailBlacklisted === true;
}

/**
 * Add somebody to one of our lists, creating the contact if needed.
 *
 * Refuses silently and safely when: syncing is off, the list is not configured,
 * or the person has unsubscribed.
 */
export async function addToList(
  list: ManagedList,
  email: string,
  attributes?: Record<string, unknown>,
): Promise<ContactResult> {
  if (!enabled()) return { ok: true, skipped: "transport_off" };

  const id = listId(list);
  if (!id) return { ok: true, skipped: "not_configured" };

  try {
    if (await isUnsubscribed(email)) {
      return { ok: true, skipped: "unsubscribed" };
    }

    const { status, body } = await api("/contacts", {
      method: "POST",
      body: JSON.stringify({
        email,
        listIds: [id],
        // Updates the contact if it already exists rather than failing.
        updateEnabled: true,
        ...(attributes ? { attributes } : {}),
        // emailBlacklisted is deliberately absent. Sending it — even as false —
        // could clear somebody's unsubscribe.
      }),
    });

    // 201 created, 204 updated.
    if (status === 201 || status === 204) return { ok: true };

    return { ok: false, error: `brevo contacts ${status}: ${JSON.stringify(body).slice(0, 160)}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "brevo contact sync failed",
    };
  }
}

/**
 * Remove somebody from one of our lists.
 *
 * Used when a membership ends: they stop being a Member, but REMAIN a Customer,
 * because soft opt-in rests on having bought rather than on currently holding a
 * subscription.
 *
 * This removes a list membership only. The contact and any other list they are
 * on are untouched.
 */
export async function removeFromList(
  list: ManagedList,
  email: string,
): Promise<ContactResult> {
  if (!enabled()) return { ok: true, skipped: "transport_off" };

  const id = listId(list);
  if (!id) return { ok: true, skipped: "not_configured" };

  // Guard against a caller passing a list id that is not ours.
  if (!ourListIds().includes(id)) {
    return { ok: false, error: "refusing to modify a list this project does not own" };
  }

  try {
    const { status, body } = await api(`/contacts/lists/${id}/contacts/remove`, {
      method: "POST",
      body: JSON.stringify({ emails: [email] }),
    });

    // 404 means they were not on it, which is the state we wanted anyway.
    if (status === 201 || status === 204 || status === 404) return { ok: true };

    return { ok: false, error: `brevo list remove ${status}: ${JSON.stringify(body).slice(0, 160)}` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "brevo list removal failed",
    };
  }
}
