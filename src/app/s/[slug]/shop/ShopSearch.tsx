"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Icon } from "@/components/Icon";
import { filterHref, type BrowseFilters } from "../_components/browse";

const TYPING_PAUSE_MS = 300;

/** The catalogue search: the grid follows as you type. Still a plain form, so Enter works and it works without JavaScript. */
export function ShopSearch({ slug, filters, label, placeholder }: { slug: string; filters: BrowseFilters; label: string; placeholder: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return (
    <form action={`/s/${slug}/shop`} role="search" className="sl-search">
      <Icon name="search" />
      <input
        type="search"
        name="q"
        defaultValue={filters.q}
        maxLength={100}
        aria-label={label}
        placeholder={placeholder}
        enterKeyHint="search"
        onChange={(e) => {
          const q = e.target.value.trim() || undefined;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => router.replace(filterHref(slug, filters, { q }), { scroll: false }), TYPING_PAUSE_MS);
        }}
      />
      {/* A new search keeps the category, collection and price range. */}
      {(["cat", "sort", "min", "max"] as const).map((k) => filters[k] && <input key={k} type="hidden" name={k} value={filters[k]} />)}
    </form>
  );
}
