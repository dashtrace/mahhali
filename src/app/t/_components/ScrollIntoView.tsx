"use client";

import { useEffect } from "react";

/** Brings the element into view once when the page opens. */
export function ScrollIntoView({ id }: { id: string }) {
  useEffect(() => {
    // Wait for the route to paint: immediate scrolling can be overridden by
    // Next.js navigation restoration while the result is being hydrated.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const result = document.getElementById(id);
        if (!result) return;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        result.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [id]);
  return null;
}
