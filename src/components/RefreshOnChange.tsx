"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Polls `url` (a route answering { version }) every `seconds` and re-renders the page's
 * server components only when the version changes, so a list picks up new rows within a
 * few seconds without reloading anything when nothing changed. Client state is kept.
 * Same guards as AutoRefresh: only while the tab is visible and online, never while
 * someone is typing in a form.
 */
export function RefreshOnChange({ url, seconds }: { url: string; seconds: number }) {
  const router = useRouter();
  const version = useRef<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const tick = async () => {
      if (busy.current || document.visibilityState !== "visible" || !navigator.onLine || document.activeElement?.closest("form")) return;
      busy.current = true;
      try {
        const res = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        if (!res.ok) return;
        const { version: next } = (await res.json()) as { version: string };
        if (version.current !== null && next !== version.current) router.refresh();
        version.current = next;
      } catch {
        // Offline for a moment: try again on the next tick.
      } finally {
        busy.current = false;
      }
    };
    void tick();
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, url, seconds]);
  return null;
}
