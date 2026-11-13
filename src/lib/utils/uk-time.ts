/**
 * Date-times typed into admin forms are UK time, whoever types them and
 * wherever the server runs (2026-11-04: Admin read them in the server's own
 * zone — UTC on Vercel, an hour out all summer — and filled the edit form with
 * the UTC clock, so saving a record unchanged could move it).
 *
 * A `datetime-local` input has no zone: these turn what it holds into an
 * instant and back, by what London's clock shows at that moment, so both are
 * right either side of a clock change.
 */
const LONDON = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** London's wall clock at an instant, as if it were UTC (ms). */
function londonWallAsUtc(instant: Date): number {
  const parts = LONDON.formatToParts(instant);
  const part = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}

/** "2026-10-13T16:00" as typed, read as UK time, to an ISO instant. Null if it is not that shape. */
export function ukLocalToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(asUtc - (londonWallAsUtc(new Date(asUtc)) - asUtc)).toISOString();
}

/** A stored instant as a `datetime-local` value in UK time: "2026-10-13T16:00". */
export function isoToUkLocal(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(+instant)) return "";
  return new Date(londonWallAsUtc(instant)).toISOString().slice(0, 16);
}

/**
 * The start of today in the UK as a `datetime-local` value: "2026-11-12T00:00".
 * The earliest an admin date picker offers for something being scheduled.
 */
export function ukTodayStartLocal(now: Date = new Date()): string {
  return `${isoToUkLocal(now.toISOString()).slice(0, 10)}T00:00`;
}
