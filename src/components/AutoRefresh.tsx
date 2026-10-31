"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the page's server components every `seconds` while the tab is visible,
 * and right away when it comes back into view. Client state (inputs, open tabs) is kept.
 * Skips a tick while offline or while someone is typing in a form: a failed refresh makes
 * Next fall back to a full page load, which would wipe what they typed.
 * shortcut: polling re-renders the whole page; switch to SSE if load matters.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine || document.activeElement?.closest("form")) return;
      router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, seconds]);
  return null;
}
