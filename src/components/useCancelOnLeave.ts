"use client";

import { useEffect, type RefObject } from "react";

/**
 * Stops a pending debounced navigation once the person leaves, or it brings them back: on unmount,
 * and on a link click, because a slow navigation hasn't unmounted anything when the timer runs.
 */
export function useCancelOnLeave(timer: RefObject<ReturnType<typeof setTimeout> | undefined>) {
  useEffect(() => {
    const cancel = () => clearTimeout(timer.current);
    const onClick = (e: MouseEvent) => {
      if ((e.target as Element).closest("a")) cancel();
    };
    addEventListener("click", onClick, true);
    return () => {
      removeEventListener("click", onClick, true);
      cancel();
    };
  }, [timer]);
}
