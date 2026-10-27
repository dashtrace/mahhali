"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: IconName };

// "/dashboard" (the order board) owns only itself and /dashboard/orders/*.
const matches = (path: string, href: string) =>
  href === "/dashboard" ? path === href || path.startsWith("/dashboard/orders") : path === href || path.startsWith(`${href}/`);

/** The matching item with the longest href, so /admin/audit is "Audit", not "Shops". */
function activeHref(pathname: string, items: { href: string }[]) {
  return items.filter((i) => matches(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

/** Desktop: a sidebar with every section. */
export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const active = activeHref(usePathname(), items);
  return (
    <nav aria-label={label} className="sticky top-[60px] hidden w-60 shrink-0 flex-col gap-1 self-start p-3 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active ? "page" : undefined}
          className={cx(
            "flex min-h-11 items-center gap-3 rounded-sl px-3 text-sm font-semibold text-sl-muted hover:bg-sl-panel hover:text-sl-fg",
            "aria-[current=page]:bg-sl-soft aria-[current=page]:font-extrabold aria-[current=page]:text-sl-soft-ink",
          )}
        >
          <Icon name={item.icon} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Phones: a bottom bar with the first four sections and "More" for the rest. */
export function BottomNav({ items, more, label }: { items: NavItem[]; more: NavItem | null; label: string }) {
  const shown = more ? [...items, more] : items;
  const active = activeHref(usePathname(), shown);
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-sl-border bg-sl-nav pb-[env(safe-area-inset-bottom)] shadow-[0_-7px_20px_#00000008] md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={item.href === active ? "page" : undefined}
              className="flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 text-center text-[11px] leading-tight text-sl-muted aria-[current=page]:font-extrabold aria-[current=page]:text-sl-accent"
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
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
