import { PeriodQuery } from "@/server/validation/money";

/** ?from=&to= from the URL; an invalid range falls back to the last 30 days. */
export function readPeriod(sp: { from?: string; to?: string }) {
  const parsed = PeriodQuery.safeParse({ from: sp.from || undefined, to: sp.to || undefined });
  return parsed.success ? parsed.data : {};
}
