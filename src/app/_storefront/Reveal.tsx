"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Fades its children in as they scroll into view. Only script hides them, and only
 * below the fold, so they stay visible without JavaScript and under reduced motion.
 */
export function Reveal({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < innerHeight) return;
    el.dataset.reveal = "hidden";
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      el.dataset.reveal = "shown";
      observer.disconnect();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
