"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Sheet } from "@/components/Sheet";
import type { Locale } from "@/i18n/locale";
import { DashIcon, type DashIconName } from "./DashIcon";

export type NavItem = { href: string; label: string; icon: DashIconName };
export type NavGroup = { title: string; items: NavItem[] };

// "/dashboard" (the order board) owns only itself and /dashboard/orders/*.
const matches = (path: string, href: string) =>
  href === "/dashboard" ? path === href || path.startsWith("/dashboard/orders") : path === href || path.startsWith(`${href}/`);

/** The matching item with the longest href, so /admin/audit is "Audit", not "Shops". */
function activeHref(pathname: string, items: { href: string }[]) {
  return items.filter((i) => matches(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

const useActive = (groups: NavGroup[]) => activeHref(usePathname(), groups.flatMap((g) => g.items));

/** Desktop: every section the role can open, in groups. */
export function SideNav({ groups, label }: { groups: NavGroup[]; label: string }) {
  const active = useActive(groups);
  return (
    <nav aria-label={label} className="sidebar">
      {groups.map((g) => (
        <div key={g.title} className="nav-group">
          <div className="nav-group-title">{g.title}</div>
          {g.items.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.href === active ? "page" : undefined} className="navlink">
              <DashIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}

/** Phones: the daily tools the role can open, never padded with others. */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const active = activeHref(usePathname(), items);
  return (
    <nav aria-label={label} className="mobile-bottom" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.href === active ? "page" : undefined}>
          <DashIcon name={item.icon} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Phones: the top bar's "All pages" button and its drawer, with the same groups as the sidebar. */
export function AllPages({
  groups,
  locale,
  labels,
}: {
  groups: NavGroup[];
  locale: Locale;
  labels: { open: string; title: string; hint: string; language: string };
}) {
  const [open, setOpen] = useState(false);
  const active = useActive(groups);
  return (
    <>
      <button type="button" className="btn allpages-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <DashIcon name="menu" />
        {labels.open}
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        locale={locale}
        side="end"
        className="sl-drawer"
        title={
          <>
            {labels.title}
            <span className="hint">{labels.hint}</span>
          </>
        }
      >
        <div>
          {groups.map((g) => (
            <div key={g.title}>
              <div className="drawer-group">{g.title}</div>
              {g.items.map((item) => (
                <Link key={item.href} href={item.href} aria-current={item.href === active ? "page" : undefined} className="drawer-nav">
                  <DashIcon name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
          {/* The top bar has no room for this on phones. */}
          <div className="drawer-group">{labels.language}</div>
          <LanguageToggle locale={locale} className="drawer-nav" />
        </div>
      </Sheet>
    </>
  );
}

/** Header links with aria-current (admin area). */
export function TopLinks({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const active = activeHref(usePathname(), items);
  return (
    <nav aria-label={label} className="flex">
      {items.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={l.href === active ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-sl px-3 text-sm font-semibold text-sl-muted hover:bg-sl-cat hover:text-sl-fg aria-[current=page]:bg-sl-soft aria-[current=page]:text-sl-soft-ink"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
