"use server";

import { entitlementFor, type EntitlementState } from "@/lib/commerce/entitlements";
import { heldPass } from "@/lib/commerce/pass-upgrade";
import { RENEWAL_WINDOW_DAYS } from "@/lib/commerce/sale-check";
import { queueEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const OWNABLE = ["course", "cohort", "group_coaching_series"] as const;
type Ownable = (typeof OWNABLE)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What the visitor already holds for one product page — note 03 §5.
 *
 * Asked by the page after it loads, because the page itself is pre-built and
 * the same for everyone (note 10 §47.1). The id reaches a PostgREST filter, so
 * it is checked to be a UUID; RLS still limits the answer to the caller.
 */
export async function viewerEntitlementAction(resourceType: string, resourceId: string): Promise<EntitlementState> {
  if (!OWNABLE.includes(resourceType as Ownable) || !UUID.test(resourceId)) {
    return { state: "none" };
  }
  return entitlementFor(resourceType as Ownable, resourceId);
}

export type RetreatViewerState = {
  /** The visitor already holds a place (bought, or through their membership). */
  entitled: boolean;
  /** `coaching_sale_status` for this visitor, or null when it could not be asked. */
  sale: string | null;
  /** Signed in: an application can be made from the page. */
  signedIn: boolean;
  /**
   * For a by-interview retreat: the batch taking applications now, and the
   * visitor's own application for it, if any (migration 0032).
   */
  application: {
    batchId: string;
    batchLabel: string;
    status: string | null;
  } | null;
};

/**
 * What one retreat level looks like to this visitor — migration 0012.
 *
 * Asked after the page loads, for the same reason as above. Two things only
 * the database knows: whether they already have a place, and whether they may
 * buy one (a level entered by interview opens to someone once their
 * application is approved; a level with limited places closes when full).
 */
export async function retreatViewerAction(retreatId: string, productId: string | null): Promise<RetreatViewerState> {
  if (!UUID.test(retreatId) || (productId !== null && !UUID.test(productId))) {
    return { entitled: false, sale: null, signedIn: false, application: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // "Already has a place" is a place on a batch that has not finished, or a
  // pass that covers the retreat (migration 0030): exactly when the sale
  // status says "owned". A place on a batch long over no longer counts, so
  // someone who went last year can book this year's.
  const { data: sale } = productId
    ? await supabase.rpc("coaching_sale_status", { p_product_id: productId })
    : { data: null };

  // The batch taking applications: a published batch of a by-interview
  // retreat whose registration is open. Read through the public dates, as
  // a batch row itself is not public.
  let application: RetreatViewerState["application"] = null;
  if (sale === "application" || sale === "ok") {
    const [{ data: retreat }, { data: dates }] = await Promise.all([
      supabase.from("retreats").select("requires_application").eq("id", retreatId).maybeSingle(),
      supabase.rpc("retreat_batch_dates", { p_retreat_ids: [retreatId] }),
    ]);
    const now = Date.now();
    const open = (
      (dates ?? []) as Array<{
        id: string;
        label: string;
        registration_opens_at: string;
        registration_closes_at: string | null;
        starts_at: string;
      }>
    ).find(
      (b) =>
        +new Date(b.registration_opens_at) <= now &&
        +new Date(b.registration_closes_at ?? b.starts_at) > now &&
        +new Date(b.starts_at) > now,
    );
    if (retreat?.requires_application && open) {
      const { data: mine } = user
        ? await supabase
            .from("retreat_applications")
            .select("status")
            .eq("batch_id", open.id)
            .eq("user_id", user.id)
            .maybeSingle()
        : { data: null };
      application = {
        batchId: open.id,
        batchLabel: open.label,
        status: mine?.status ?? null,
      };
    }
  }

  return {
    entitled: Boolean(user) && sale === "owned",
    sale: typeof sale === "string" ? sale : null,
    signedIn: Boolean(user),
    application,
  };
}

export type ApplyState = { error?: string; status?: string };

/**
 * Apply for a by-interview retreat's batch from its page — migration 0032.
 *
 * The database decides (`apply_for_retreat`): signed in, a by-interview
 * retreat, its registration open. The application is saved first; the email
 * to the site owner is a notification on top, as with the contact form, and
 * goes to the owner's address, never the applicant's.
 */
export async function applyForRetreatAction(_prev: ApplyState, formData: FormData): Promise<ApplyState> {
  const batchId = String(formData.get("batchId") ?? "");
  const project = String(formData.get("project") ?? "")
    .trim()
    .slice(0, 4000);
  const experience = String(formData.get("experience") ?? "")
    .trim()
    .slice(0, 4000);
  const hopes = String(formData.get("hopes") ?? "")
    .trim()
    .slice(0, 4000);
  if (!UUID.test(batchId))
    return {
      error: "Something went wrong. Please reload the page and try again.",
    };
  if (!project) return { error: "Tell us about your project." };

  const message = [
    `About the project:\n${project}`,
    experience ? `Experience so far:\n${experience}` : "",
    hopes ? `Hoping to get from the retreat:\n${hopes}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to apply." };

  const { data: status, error } = await supabase.rpc("apply_for_retreat", {
    p_batch_id: batchId,
    p_message: message,
    p_answers: { project, experience, hopes },
  });
  if (error) {
    return {
      error: /closed/.test(error.message)
        ? "Applications for this batch have closed."
        : "We could not send your application. Please try again shortly.",
    };
  }

  const notify = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (status === "submitted") {
    const admin = createAdminClient();
    const [{ data: batch }, { data: profile }] = await Promise.all([
      admin.from("retreat_batches").select("label,retreats(name,slug)").eq("id", batchId).maybeSingle(),
      admin.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);
    const retreat = batch?.retreats as unknown as {
      name: string;
      slug: string;
    } | null;
    // The applicant hears it has arrived (owner, 2026-10-23); staff hear below.
    if (user.email) {
      await queueEmail({
        idempotencyKey: `retreat-application-sent:${batchId}:${user.id}`,
        template: "retreat_application_sent",
        to: user.email,
        payload: {
          retreat: retreat?.name ?? "the retreat",
          batch: batch?.label ?? "",
          slug: retreat?.slug ?? "",
        },
      });
    }
    if (notify) {
      await queueEmail({
        idempotencyKey: `retreat-application:${batchId}:${user.id}:${Date.now()}`,
        template: "retreat_application_received",
        to: notify,
        payload: {
          name: profile?.display_name ?? user.email,
          email: user.email,
          retreat: retreat?.name ?? "A retreat",
          batch: batch?.label ?? "",
          message,
        },
      });
    }
  }

  return { status: typeof status === "string" ? status : "submitted" };
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

/**
 * Whether this visitor may buy each of these products now — migration 0012.
 *
 * For the purchase panels of pre-built product pages: somebody who still holds
 * sessions is told so in place of the buy button, rather than at checkout.
 * Display only — checkout asks the database the same question.
 */
export async function viewerSaleStatusAction(slugs: string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(slugs)].filter((s) => SLUG.test(s)).slice(0, 12);
  if (wanted.length === 0) return {};

  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id,slug")
    .in("slug", wanted)
    .eq("status", "active");

  const result: Record<string, string> = {};
  await Promise.all(
    (products ?? []).map(async (p) => {
      const { data } = await supabase.rpc("coaching_sale_status", {
        p_product_id: p.id,
      });
      if (typeof data === "string") result[p.slug] = data;
    }),
  );
  return result;
}

/**
 * The Coaching Pass this visitor holds, for the pass pages — note 09 §28.1.
 *
 * Those pages are pre-built and offered "Get Silver Pass" to somebody who
 * already held Gold, and let them reach checkout before saying no (owner,
 * 2026-10-10). Asked after the page loads, this lets each tier say what it is
 * TO THEM: the pass they have, one their pass already covers, one they can
 * move up to, or one they can renew. Display only: checkout asks the same
 * question of the database (`saleCheck`).
 */
export type ViewerPass = {
  tierName: string;
  rank: number;
  /** "29 September 2027", or null where it has no end. */
  endsOn: string | null;
  /** "30 August 2027": the first day the same or a lower tier can be bought again. */
  renewFrom: string | null;
  /** That day has come. */
  renewable: boolean;
  /** Held as a renewing subscription: it has to be cancelled before buying a pass. */
  subscription: boolean;
  /** Its own price today, in minor units: an upgrade costs the difference from it. */
  amount: number | null;
  /** At least four months of it remain, so it can be moved up (migration 0027). */
  canUpgrade: boolean;
  /** "29 May 2027": the last day it can be moved up. */
  upgradeUntil: string | null;
};

export async function viewerPassAction(): Promise<ViewerPass | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const held = await heldPass(supabase);
  if (!held) return null;

  const day = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/London",
    });
  const ends = held.expiresAt ? new Date(held.expiresAt) : null;
  const opens = ends ? new Date(ends.getTime() - RENEWAL_WINDOW_DAYS * 86_400_000) : null;

  return {
    tierName: held.tierName,
    rank: held.rank,
    endsOn: ends ? day(ends) : null,
    renewFrom: opens ? day(opens) : null,
    renewable: opens ? Date.now() >= opens.getTime() : false,
    subscription: held.subscription,
    amount: held.amount,
    canUpgrade: held.canUpgrade,
    upgradeUntil: held.upgradeUntil ? day(new Date(held.upgradeUntil)) : null,
  };
}
