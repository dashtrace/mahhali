import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { dirOf, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { storeMessages } from "@/i18n/messages/store";
import { themeVars } from "../_server/theme";
import { CartLink } from "./cart";

type Shop = { name: string; slug: string; logo: string | null; theme: unknown };

/** The shop's own look and language around every public shop page. */
export function ShopFrame({ shop, locale, cart, children }: { shop: Shop; locale: Locale; cart?: boolean; children: ReactNode }) {
  const m = storeMessages[locale];
  return (
    <div
      lang={locale}
      dir={dirOf(locale)}
      style={{ ...themeVars(shop.theme), fontFamily: "var(--font-shop)" }}
      className="flex min-h-dvh flex-col bg-[var(--surface)] text-[var(--ink)]"
    >
      <header className="sticky top-0 z-20 border-b border-black/10 bg-[var(--surface)]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
          <Link href={`/s/${shop.slug}`} className="flex min-h-11 min-w-0 items-center gap-2">
            {shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
              <img src={shop.logo} alt="" className="size-9 rounded-[var(--radius)] object-cover" />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-[var(--brand)] font-semibold text-[var(--brand-ink)]">
                {shop.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-semibold">{shop.name}</span>
          </Link>
          <nav className="ms-auto flex items-center gap-1">
            <Link
              href={`/s/${shop.slug}/track`}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[var(--radius)] px-2 text-sm hover:bg-black/5"
            >
              <Icon name="search" />
              <span className="sr-only sm:not-sr-only">{m.trackOrder}</span>
            </Link>
            {cart && <CartLink slug={shop.slug} label={m.cart} countLabel={m.cartCount} />}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">{children}</main>
      <footer className="py-6 text-center text-xs opacity-60">
        <Link href="/" className="inline-flex min-h-11 items-center hover:underline">
          {common[locale].poweredBy}
        </Link>
      </footer>
    </div>
  );
}

/** A page with one message, for links that no longer work (no shop to dress it in). */
export function Notice({ locale, title, body }: { locale: Locale; title: string; body?: string }) {
  return (
    <main lang={locale} dir={dirOf(locale)} className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      {body && <p className="text-sm text-stone-600">{body}</p>}
      <Link href="/" className="mt-4 inline-flex min-h-11 items-center justify-center text-sm text-[var(--brand)] hover:underline">
        {common[locale].appName}
      </Link>
    </main>
  );
}

/** Average rating as five stars, with the count beside it. */
export function Stars({ average, count, label }: { average: number; count?: number; label: string }) {
  const full = Math.round(average);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span aria-hidden className="tracking-tight">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= full ? "text-amber-500" : "opacity-25"}>
            ★
          </span>
        ))}
      </span>
      {count !== undefined && <span aria-hidden className="tabular-nums opacity-70">({count})</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
