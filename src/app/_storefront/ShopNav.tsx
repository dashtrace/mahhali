"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { IconButton, cx } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";

// The interactive parts of ShopFrame: the menu drawer, the top nav and the
// WhatsApp button. The drawer's links are rendered on the server and passed in.

type Tab = "home" | "shop" | "track";

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
      <IconButton label={common[locale].menuOpen} icon="menu" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className="sl-nav-btn" />
      <Sheet open={open} onClose={() => setOpen(false)} title={title} locale={locale}>
        {children}
      </Sheet>
    </>
  );
}

const TOP_PX = 40;

function subscribeScroll(onChange: () => void) {
  addEventListener("scroll", onChange, { passive: true });
  return () => removeEventListener("scroll", onChange);
}

/** Over the hero at the top of the page (colours in globals.css), a slim glass bar once scrolled. */
export function OverlayHeader({ tone, children }: { tone: "photo" | "band"; children: ReactNode }) {
  const top = useSyncExternalStore(subscribeScroll, () => scrollY < TOP_PX, () => true);
  return (
    <header data-over={tone} data-top={top} className="sl-header fixed inset-x-0 top-0 z-30">
      {children}
    </header>
  );
}

/** Desktop: a group of text links in the header, either side of the brand. */
export function ShopTopNav({ slug, label, links }: { slug: string; label: string; links: { href: string; label: string; tab?: Tab }[] }) {
  const active = activeTab(usePathname(), slug);
  return (
    <nav aria-label={label} className="sl-nav-links">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={l.tab && active === l.tab ? "page" : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: the Track shortcut beside the menu. */
export function TrackPill({ slug, locale }: { slug: string; locale: Locale }) {
  const t = common[locale];
  return (
    <Link href={`/s/${slug}/track`} aria-label={t.trackOrder} aria-current={activeTab(usePathname(), slug) === "track" ? "page" : undefined} className="sl-track">
      {t.navTrack}
    </Link>
  );
}

/** Floating WhatsApp button, shown by ShopFrame on the shop's home page only (as in the mockup). */
export function WhatsAppFab({ href, locale }: { href: string; locale: Locale }) {
  const t = common[locale];
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
