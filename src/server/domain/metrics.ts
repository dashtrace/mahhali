// Outcome metrics for the pilot: time from first message to confirmed order,
// and orders handled per day. Pure; the service loads the rows.
const DAY_MS = 86_400_000;

/** A reporting range: from and to are inclusive UTC days, end is the exclusive instant after "to". */
export type Period = { from: string; to: string; start: Date; end: Date };

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** YYYY-MM-DD bounds, the last 30 days (today included) when missing. */
export function periodOf(from: string | undefined, to: string | undefined, now: Date): Period {
  const end = new Date(Date.parse(to ?? isoDay(now)) + DAY_MS);
  const start = from ? new Date(Date.parse(from)) : new Date(end.getTime() - 30 * DAY_MS);
  return { from: isoDay(start), to: isoDay(new Date(end.getTime() - DAY_MS)), start, end };
}

/** Median minutes from first contact to confirmation; null when nothing was confirmed. */
export function medianConfirmMinutes(orders: { firstContactAt: Date; confirmedAt: Date | null }[]): number | null {
  const minutes = orders
    .flatMap((o) => (o.confirmedAt ? [(o.confirmedAt.getTime() - o.firstContactAt.getTime()) / 60_000] : []))
    .sort((a, b) => a - b);
  if (minutes.length === 0) return null;
  const mid = Math.floor(minutes.length / 2);
  return minutes.length % 2 === 1 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
}

/** Orders created in the period divided by its days. */
export function ordersPerDay(count: number, period: Period): number {
  return count / Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS);
}
