"use client";

import { useEffect, useState } from "react";

/** A next-item control for a real horizontally scrollable row. Native swiping/scrolling still works. */
export function ScrollArrow({ targetId, locale }: { targetId: string; locale: "en" | "ar" }) {
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const row = document.getElementById(targetId);
    if (!row) return;

    const update = () => {
      const available = row.scrollWidth - row.clientWidth;
      // Browsers may report negative scrollLeft for RTL; magnitude measures progress in either direction.
      setHasMore(available > 2 && Math.abs(row.scrollLeft) < available - 2);
    };
    const observer = new ResizeObserver(update);
    observer.observe(row);
    for (const child of row.children) observer.observe(child);
    row.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      row.removeEventListener("scroll", update);
    };
  }, [targetId]);

  if (!hasMore) return null;

  function next() {
    const row = document.getElementById(targetId);
    if (!row) return;
    const direction = getComputedStyle(row).direction === "rtl" ? -1 : 1;
    row.scrollBy({ left: direction * Math.max(180, row.clientWidth * 0.7), behavior: "smooth" });
  }

  return (
    <button type="button" className="sl-scroll-next" onClick={next} aria-label={locale === "ar" ? "عرض المزيد" : "Scroll to see more"}>
      <span aria-hidden="true">{locale === "ar" ? "←" : "→"}</span>
    </button>
  );
}
