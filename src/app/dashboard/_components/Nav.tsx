"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: IconName };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" || pathname.startsWith("/dashboard/orders") : pathname.startsWith(href);
}

/** Desktop: a sidebar with every section. */
export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="sticky top-16 hidden w-56 shrink-0 flex-col gap-1 self-start p-3 md:flex">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={cx(
            "flex min-h-11 items-center gap-3 rounded-[var(--radius)] px-3 text-sm font-medium",
            isActive(pathname, item.href) ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-stone-700 hover:bg-stone-100",
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
export function BottomNav({ items, more }: { items: NavItem[]; more: NavItem | null }) {
  const pathname = usePathname();
  const shown = more ? [...items, more] : items;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
        {shown.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
                  active ? "text-[var(--brand)]" : "text-stone-500",
                )}
              >
                <Icon name={item.icon} className="size-6" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
