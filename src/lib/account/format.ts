/**
 * Account date formatting. London time throughout: the business runs on it,
 * and a server rendering in UTC would otherwise shift evening sessions by an
 * hour for half the year.
 */
const TZ = "Europe/London";

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Day number and short month for a date badge. */
export function dateBadge(value: string) {
  const d = new Date(value);
  return {
    day: d.toLocaleDateString("en-GB", { day: "numeric", timeZone: TZ }),
    month: d.toLocaleDateString("en-GB", { month: "short", timeZone: TZ }),
  };
}
