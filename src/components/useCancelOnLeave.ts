"use client";

import { useEffect, type RefObject } from "react";

/**
 * Stops a pending debounced navigation once the person leaves, or it brings them back: on unmount,
 * and on a link click, because a slow navigation hasn't unmounted anything when the timer runs.
 */
export function useCancelOnLeave(timer: RefObject<ReturnType<typeof setTimeout> | undefined>) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a")) clearTimeout(timer.current);
    };
    addEventListener("click", onClick, true);
    return () => {
      removeEventListener("click", onClick, true);
      clearTimeout(timer.current);
    };
  }, [timer]);
}
