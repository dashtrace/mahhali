import { tooManyRequests } from "./errors";

// shortcut: counters live in this process, which is right for the single app
// container we run; move them to Postgres or Redis before running two instances.
const windows = new Map<string, { count: number; resetAt: number }>();

/** Fixed-window limit: throws 429 once `key` was used `limit` times in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    if (windows.size > 10_000) sweep(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  w.count += 1;
  if (w.count > limit) throw tooManyRequests(Math.ceil((w.resetAt - now) / 1000));
}

/** The caller's address as Caddy forwards it. */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export function resetRateLimits() {
  windows.clear();
}

function sweep(now: number) {
  for (const [key, w] of windows) if (w.resetAt <= now) windows.delete(key);
}
