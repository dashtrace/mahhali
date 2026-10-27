"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { IconButton, cx } from "@/components/ui";
import { fill, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { useCart } from "./cart";

// The interactive parts of ShopFrame: the menu drawer, the tab bars and the
// WhatsApp button. The drawer's links are rendered on the server and passed in.

type Tab = "home" | "shop" | "track" | "cart";

const TABS: { key: Tab; icon: IconName; path: string }[] = [
  { key: "home", icon: "home", path: "" },
  { key: "shop", icon: "bag", path: "/shop" },
  { key: "track", icon: "box", path: "/track" },
  { key: "cart", icon: "cart", path: "/cart" },
];

const LABEL = { home: "navHome", shop: "navShop", track: "navTrack", cart: "navCart" } as const;

function activeTab(pathname: string, slug: string): Tab | null {
  const base = `/s/${slug}`;
  const under = (p: string) => pathname === `${base}${p}` || pathname.startsWith(`${base}${p}/`);
  if (pathname === base) return "home";
  if (under("/shop") || under("/p")) return "shop";
  if (under("/track") || pathname.startsWith("/t/")) return "track";
  if (under("/cart")) return "cart";
  return null;
}

/** Hamburger button and the slide-in menu holding `children`. */
export function ShopMenu({ title, locale, children }: { title: string; locale: Locale; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label={common[locale].menuOpen} icon="menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title={title} locale={locale}>
        {children}
      </Sheet>
    </>
  );
}

/** Desktop: Home / Shop / Track links in the header. */
export function ShopTopNav({ slug, locale }: { slug: string; locale: Locale }) {
  const t = common[locale];
  const active = activeTab(usePathname(), slug);
  return (
    <nav aria-label={t.storeNav} className="hidden items-center gap-1 md:flex">
      {TABS.filter((tab) => tab.key !== "cart").map((tab) => (
        <Link
          key={tab.key}
          href={`/s/${slug}${tab.path}`}
          aria-current={active === tab.key ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-muted hover:text-sl-fg aria-[current=page]:font-extrabold aria-[current=page]:text-sl-accent"
        >
          {t[LABEL[tab.key]]}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: the fixed Home / Shop / Track / Cart bar with the cart count. */
export function ShopTabBar({ slug, locale }: { slug: string; locale: Locale }) {
  const t = common[locale];
  const active = activeTab(usePathname(), slug);
  const { count } = useCart(slug);
  return (
    <nav
      aria-label={t.storeNav}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-sl-border bg-sl-nav pb-[env(safe-area-inset-bottom)] shadow-[0_-7px_20px_#00000008] md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((tab) => {
          const current = active === tab.key;
          const badge = tab.key === "cart" && count > 0;
          return (
            <li key={tab.key}>
              <Link
                href={`/s/${slug}${tab.path}`}
                aria-current={current ? "page" : undefined}
                aria-label={badge ? fill(t.cartCount, { n: count }) : undefined}
                className="flex min-h-[60px] flex-col items-center justify-center gap-1 text-[11px] text-sl-muted aria-[current=page]:font-extrabold aria-[current=page]:text-sl-accent"
              >
                <span className="relative">
                  <Icon name={tab.icon} solid={current} />
                  {badge && (
                    <span className="absolute -end-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-sl-accent px-1 text-[10px] font-extrabold text-sl-accent-ink tabular-nums">
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </span>
                {t[LABEL[tab.key]]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Floating WhatsApp button, on the shop's home page only (as in the mockup). */
export function WhatsAppFab({ slug, href, locale }: { slug: string; href: string; locale: Locale }) {
  const t = common[locale];
  if (activeTab(usePathname(), slug) !== "home") return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t.whatsappChat} (${t.opensNewTab})`}
      className={cx(
        "fixed end-3.5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 grid size-[52px] place-items-center rounded-full border-2 border-white",
        "bg-sl-whatsapp text-white shadow-[0_5px_14px_#0004] transition-transform hover:scale-[1.04] md:bottom-6",
      )}
    >
      <Icon name="whatsapp" className="size-7" />
    </a>
  );
}
