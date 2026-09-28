/**
 * Academy time formatting. London time throughout, as `lib/account/format`
 * does: the business runs on it and the server renders in UTC.
 */
const TZ = "Europe/London";

/** "12 min", "1 hr 5 min" — a running time, rounded to the minute. */
export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Reading time at 220 words a minute, never under a minute. */
export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 220));
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "Tue 14 Oct, 18:00 – 19:30" */
export function formatSlot(startsAt: string, endsAt?: string | null) {
  const day = new Date(startsAt).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
  return endsAt
    ? `${day}, ${formatTime(startsAt)} – ${formatTime(endsAt)}`
    : `${day}, ${formatTime(startsAt)}`;
}

export function greetingFor(date = new Date()) {
  const hour = Number(
    date.toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }),
  );
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
