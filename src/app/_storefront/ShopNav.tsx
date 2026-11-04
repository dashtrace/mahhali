"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { IconButton, cx } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";

// The interactive parts of ShopFrame: the menu drawer, the top nav and the
// WhatsApp button. The drawer's links are rendered on the server and passed in.

type Tab = "home" | "shop" | "track";

const TABS: { key: Tab; path: string }[] = [
  { key: "home", path: "" },
  { key: "shop", path: "/shop" },
  { key: "track", path: "/track" },
];

const LABEL = { home: "navHome", shop: "navShop", track: "navTrack" } as const;

function activeTab(pathname: string, slug: string): Tab | null {
  const base = `/s/${slug}`;
  const under = (p: string) => pathname === `${base}${p}` || pathname.startsWith(`${base}${p}/`);
  if (pathname === base) return "home";
  if (under("/shop") || under("/p")) return "shop";
  if (under("/track") || pathname.startsWith("/t/")) return "track";
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
      {TABS.map((tab) => (
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
        "fixed end-3.5 bottom-[calc(20px+env(safe-area-inset-bottom))] z-30 grid size-[52px] place-items-center rounded-full border-2 border-white",
        "bg-sl-whatsapp text-white shadow-[0_5px_14px_#0004] transition-transform hover:scale-[1.04] md:bottom-6",
      )}
    >
      <Icon name="whatsapp" className="size-7" />
    </a>
  );
}
