/**
 * Split a list into named groups, keeping each item's order within its group
 * and the groups in the order their first item appears.
 *
 * Used wherever a list mixes things of different kinds — sessions of several
 * series, bookings of several types (owner, 2026-10-09: "they must be
 * categorised for easy understanding instead of mixing everything together").
 */
export function groupBy<T>(items: readonly T[], key: (item: T) => string): Array<{ key: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = groups.get(k);
    if (list) list.push(item);
    else groups.set(k, [item]);
  }
  return [...groups].map(([k, list]) => ({ key: k, items: list }));
}
