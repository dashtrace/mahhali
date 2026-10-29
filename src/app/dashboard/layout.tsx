import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { Chip, cx } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can, type Action } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { pageActor, signedInUser } from "../_server/session";
import { themeVars } from "../_server/theme";
import { BottomNav, SideNav, type NavItem } from "./_components/Nav";

type Key = keyof (typeof common)["en"];

// Every section, in menu order; each shows only to roles the policy allows.
const SECTIONS: { href: string; key: Key; icon: NavItem["icon"]; action: Action }[] = [
  { href: "/dashboard", key: "navOrders", icon: "orders", action: "order.read" },
  { href: "/dashboard/deliveries", key: "navDeliveries", icon: "truck", action: "order.readAssigned" },
  { href: "/dashboard/products", key: "navProducts", icon: "box", action: "product.read" },
  { href: "/dashboard/cash", key: "navCash", icon: "cash", action: "reconciliation.read" },
  { href: "/dashboard/couriers", key: "navCouriers", icon: "users", action: "courier.read" },
  { href: "/dashboard/metrics", key: "navMetrics", icon: "chart", action: "metrics.read" },
  { href: "/dashboard/reviews", key: "navReviews", icon: "star", action: "review.read" },
  { href: "/dashboard/staff", key: "navStaff", icon: "users", action: "staff.manage" },
  { href: "/dashboard/settings", key: "navSettings", icon: "gear", action: "shop.settings" },
  { href: "/dashboard/billing", key: "navBilling", icon: "card", action: "billing.manage" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const actor = await pageActor("order.readAssigned", "/dashboard");
  const [me, locale, user] = await Promise.all([accountService.me(actor), getLocale(), signedInUser()]);
  const t = common[locale];
  const items: NavItem[] = SECTIONS.filter((s) => can(actor.role, s.action)).map((s) => ({
    href: s.href,
    label: t[s.key],
    icon: s.icon,
  }));
  if (user?.isAdmin) items.push({ href: "/admin", label: t.navAdmin, icon: "shield" });
  const roleLabel = { owner: t.roleOwner, manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery }[actor.role];
  const phoneItems = items.length > 5 ? items.slice(0, 4) : items;
  const more = items.length > 5 ? { href: "/dashboard/more", label: t.navMore, icon: "more" as const } : null;

  // The platform's slate/blue palette (globals.css :root); the shop shows through its logo and name.
  // themeVars still feeds --brand/--radius to pages not yet on the sl-* tokens.
  return (
    <div style={themeVars(me.shop.theme, "chrome")} className="min-h-dvh bg-sl-bg">
      <header className="sticky top-0 z-20 border-b border-sl-border bg-sl-panel/95 backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-3 px-4">
          <Link href={items[0]?.href ?? "/dashboard"} className="flex min-h-11 min-w-0 items-center gap-2.5">
            {me.shop.logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
              <img src={me.shop.logo} alt="" className="size-10 shrink-0 rounded-sl border border-sl-border bg-sl-panel object-contain p-0.5" />
            ) : (
              <span className="grid size-10 shrink-0 place-items-center rounded-sl bg-sl-accent text-lg font-extrabold text-sl-accent-ink">
                {me.shop.name.slice(0, 1)}
              </span>
            )}
            <span className="truncate font-extrabold tracking-tight">{me.shop.name}</span>
          </Link>
          {/* max-sm:hidden, not "hidden sm:inline-flex": cx does not dedupe, so the components' own inline-flex would win */}
          <Chip className="shrink-0 max-sm:hidden">{roleLabel}</Chip>
          <div className="ms-auto flex shrink-0 items-center gap-1">
            <LanguageToggle locale={locale} />
            {/* On phones the More page carries sign-out; roles without More keep it here. */}
            <SignOutButton label={t.signOut} className={cx("whitespace-nowrap", more && "max-sm:hidden")} />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl">
        <SideNav items={items} label={t.navMain} />
        <main className="pb-safe min-w-0 flex-1 px-4 pt-4 md:pb-10">{children}</main>
      </div>
      <BottomNav items={phoneItems} more={more} label={t.navMain} />
    </div>
  );
}
