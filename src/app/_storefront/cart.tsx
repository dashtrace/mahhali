"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { fill } from "@/i18n/locale";

/** variantId -> quantity, kept in this browser per shop. */
export type Cart = Record<string, number>;

/** The order API takes 1 to 20 of each variant. */
export const MAX_QTY = 20;

const keyOf = (slug: string) => `cart:${slug}`;
const EVENT = "mahhali-cart";

function read(slug: string): Cart {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(keyOf(slug)) ?? "{}");
    const cart: Cart = {};
    if (raw && typeof raw === "object") {
      for (const [id, qty] of Object.entries(raw)) {
        if (Number.isInteger(qty) && (qty as number) > 0) cart[id] = Math.min(qty as number, MAX_QTY);
      }
    }
    return cart;
  } catch {
    return {};
  }
}

/** The shop's cart, kept in sync across components and tabs. */
export function useCart(slug: string) {
  const [cart, setCart] = useState<Cart>({});
  useEffect(() => {
    const sync = () => setCart(read(slug));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [slug]);

  function save(next: Cart) {
    setCart(next);
    try {
      localStorage.setItem(keyOf(slug), JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Storage blocked (private mode): the cart lives in this component only.
    }
  }

  return { cart, save };
}

export function CartLink({ slug, label, countLabel }: { slug: string; label: string; countLabel: string }) {
  const { cart } = useCart(slug);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  return (
    <Link
      href={`/s/${slug}/cart`}
      aria-label={fill(countLabel, { n: count })}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[var(--radius)] px-2 text-sm hover:bg-black/5"
    >
      <Icon name="bag" />
      <span className="hidden sm:inline">{label}</span>
      {count > 0 && (
        <span className="absolute end-0 top-1 min-w-5 rounded-full bg-[var(--brand)] px-1 text-center text-xs font-semibold text-[var(--brand-ink)] tabular-nums">
          {count}
        </span>
      )}
    </Link>
  );
}
