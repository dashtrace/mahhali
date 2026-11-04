"use client";

import { useEffect } from "react";

/** Brings the element into view once when the page opens. */
export function ScrollIntoView({ id }: { id: string }) {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "instant" : "smooth", block: "start" });
  }, [id]);
  return null;
}
