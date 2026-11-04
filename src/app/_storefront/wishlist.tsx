"use client";

import { useMemo } from "react";
import { Icon } from "@/components/Icon";
import { IconButton, IconButtonLink, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { parseJson, readRaw, useRaw, writeRaw } from "./local";
import { showToast } from "./Toast";

// Saved product ids, on this device only (customers are guests).
const keyOf = (slug: string) => `wish:${slug}`;
const MAX_SAVED = 100;

function parseIds(raw: unknown): string[] {
  return Array.isArray(raw) ? [...new Set(raw.filter((id): id is string => typeof id === "string"))].slice(0, MAX_SAVED) : [];
}

/** Saves or unsaves a product; returns whether it is saved now. */
export function toggleWish(slug: string, productId: string): boolean {
  const ids = parseIds(parseJson(readRaw(keyOf(slug))));
  const saved = !ids.includes(productId);
  const next = saved ? [productId, ...ids].slice(0, MAX_SAVED) : ids.filter((id) => id !== productId);
  writeRaw(keyOf(slug), JSON.stringify(next));
  return saved;
}

/** Saved ids, newest first. Empty on the server and on first render. */
export function useWishlist(slug: string) {
  const raw = useRaw(keyOf(slug));
  return useMemo(() => {
    const ids = parseIds(parseJson(raw));
    return { ids, count: ids.length, has: (productId: string) => ids.includes(productId) };
  }, [raw]);
}

/**
 * The heart toggle. `card` is the small round button for ProductCard's `wish`
 * slot (44px hit area); `icon` is the header-sized IconButton.
 */
export function WishButton({ slug, productId, locale, variant = "card" }: { slug: string; productId: string; locale: Locale; variant?: "card" | "icon" }) {
  const t = common[locale];
  const saved = useWishlist(slug).has(productId);
  const label = saved ? t.wishRemove : t.wishAdd;
  const m = storeMessages[locale];
  const toggle = () => showToast(toggleWish(slug, productId) ? m.wishSaved : m.wishRemoved);
  if (variant === "icon") return <IconButton label={label} icon="heart" solid={saved} className="sl-nav-btn" onClick={toggle} />;
  return (
    <button type="button" aria-label={label} onClick={toggle} className={cx("grid size-11 place-items-center", saved ? "text-sl-accent" : "text-sl-fg")}>
      <span className="grid size-[33px] place-items-center rounded-full bg-[color-mix(in_srgb,var(--sl-panel)_91%,transparent)]">
        <Icon name="heart" solid={saved} className="size-[21px]" />
      </span>
    </button>
  );
}

/** Header link to the wishlist page; the saved count is in its label only, as the design shows a badge on the bag alone. */
export function WishLink({ slug, locale, className }: { slug: string; locale: Locale; className?: string }) {
  const t = common[locale];
  const { count } = useWishlist(slug);
  return <IconButtonLink href={`/s/${slug}/wishlist`} icon="heart" label={count > 0 ? fill(t.wishCount, { n: count }) : t.navWishlist} className={className} />;
}
