import "server-only";

import { optionGroup } from "@/lib/commerce/options";
import { formatPrice } from "@/lib/commerce/pricing";
import { listComingSessions, listRuns, listSeries } from "@/lib/content/coaching";

/**
 * The "try a session" way in, said as it stands now (owner, 2026-11-02, from
 * Elaine's "a low-cost way in": the button led to series at £130 with no
 * single session on sale). A single session is sold only once its series has
 * stopped selling and while a seat is left, the same test the Group Coaching
 * page uses. Series run side by side, so:
 *
 *   seats now        "Try a session, £25" — to the one series, or the page
 *   none yet         "Single sessions £25 from 12 November" — the earliest
 *                    date one goes on sale
 *   nothing planned  "See Group Coaching", promising nothing
 *
 * `available` is true only in the first case: the home page shows its button
 * then and not otherwise (owner, 2026-11-02); the Coaching page's closing
 * button shows every case. Price and dates read from what is on sale; the
 * lowest single price.
 */
export async function sessionEntry(): Promise<{ label: string; href: string; available: boolean }> {
  const fallback = { label: "See Group Coaching", href: "/coaching/group-coaching", available: false };
  const series = await listSeries();
  if (series.length === 0) return fallback;
  const [runs, groups, coming] = await Promise.all([
    listRuns(series.map((s) => s.id)),
    Promise.all(series.map((s) => optionGroup(`group-coaching-${s.slug}`))),
    Promise.all(series.map((s) => listComingSessions(s.id))),
  ]);
  const single = groups
    .flat()
    .filter((o) => (o.credits ?? 1) === 1)
    .sort((a, b) => a.amount - b.amount)[0];
  if (!single) return fallback;
  const price = formatPrice(single.amount, single.currency);
  const selling = (seriesId: string) =>
    runs.filter((r) => r.seriesId === seriesId && (r.state === "open" || r.state === "full" || r.state === "upcoming"));

  const onSale = series.filter((s, i) => selling(s.id).length === 0 && coming[i].some((c) => c.placesLeft > 0));
  if (onSale.length > 0) {
    return {
      label: `Try a session, ${price}`,
      href: onSale.length === 1 ? `/coaching/group-coaching/${onSale[0].slug}` : "/coaching/group-coaching",
      available: true,
    };
  }

  const next = series
    .flatMap((s) => selling(s.id).map((r) => r.registrationClosesAt))
    .sort()[0];
  if (next) {
    const day = new Date(next).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" });
    return { label: `Single sessions ${price} from ${day}`, href: "/coaching/group-coaching", available: false };
  }
  return fallback;
}
