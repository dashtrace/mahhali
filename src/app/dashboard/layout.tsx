import { DM_Sans } from "next/font/google";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can, type Action } from "@/server/domain/policy";
import { accountService } from "@/server/services/accountService";
import { reportingService } from "@/server/services/reportingService";
import { fill } from "@/i18n/locale";
import { pageActor, signedInUser } from "../_server/session";
import { DashIcon, type DashIconName } from "./_components/DashIcon";
import { AllPages, BottomNav, SideNav, type NavGroup } from "./_components/Nav";
import { openIssues } from "./cash/openIssues";
import "./dashboard.css";
import "./orders/orders.css";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap" });

type Key = keyof (typeof common)["en"];
type Section = { href: string; key: Key; icon: DashIconName; action: Action; tab?: Key };

// Every section, in menu order; each shows only to roles the policy allows.
const TODAY: Section[] = [
  { href: "/dashboard", key: "navOrders", icon: "orders", action: "order.read" },
  { href: "/dashboard/deliveries", key: "navDeliveries", icon: "truck", action: "order.readAssigned" },
  { href: "/dashboard/products", key: "navProducts", icon: "box", action: "product.read" },
  { href: "/dashboard/cash", key: "navCashFull", tab: "navCash", icon: "cash", action: "reconciliation.read" },
];
const GROUPS: { title: Key; sections: Section[] }[] = [
  { title: "navGroupToday", sections: TODAY },
  {
    title: "navGroupGrow",
    sections: [
      { href: "/dashboard/metrics", key: "navPerformance", icon: "chart", action: "metrics.read" },
      { href: "/dashboard/reviews", key: "navCustomerReviews", icon: "star", action: "review.read" },
    ],
  },
  {
    title: "navGroupPeople",
    sections: [
      { href: "/dashboard/couriers", key: "navCouriers", icon: "truck", action: "courier.read" },
      { href: "/dashboard/staff", key: "navTeamAccess", icon: "users", action: "staff.manage" },
    ],
  },
  {
    title: "navGroupShop",
    sections: [
      { href: "/dashboard/settings", key: "navStorefrontSettings", icon: "settings", action: "shop.settings" },
      { href: "/dashboard/billing", key: "navPlanBilling", icon: "plan", action: "billing.manage" },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Signed out: every page's own pageActor redirects to login with that page as `next`.
  const user = await signedInUser();
  if (!user) return children;
  const actor = await pageActor("order.readAssigned", "/dashboard");
  const [me, locale, reconciliation] = await Promise.all([
    accountService.me(actor),
    getLocale(),
    // The Cash page's default period, so the chip and the page's first view agree.
    can(actor.role, "reconciliation.read") ? reportingService.reconciliation(actor, {}) : null,
  ]);
  const t = common[locale];
  const allowed = (s: Section) => can(actor.role, s.action);
  const issues = reconciliation ? openIssues(reconciliation.couriers).count : 0;
  const issuesLabel = issues === 1 ? t.navIssuesOne : issues ? fill(t.navIssues, { n: issues }) : undefined;
  const groups: NavGroup[] = GROUPS.map((g) => ({
    title: t[g.title],
    items: g.sections.filter(allowed).map((s) => ({ href: s.href, label: t[s.key], icon: s.icon, count: s.href === "/dashboard/cash" ? issuesLabel : undefined })),
  })).filter((g) => g.items.length > 0);
  if (user?.isAdmin) groups.push({ title: t.navGroupPlatform, items: [{ href: "/admin", label: t.navAdmin, icon: "shield" }] });
  const tabs = TODAY.filter(allowed).map((s) => ({ href: s.href, label: t[s.tab ?? s.key], icon: s.icon }));
  const roleLabel = { owner: t.roleOwner, manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery }[actor.role];

  // The dashboard's own neutral palette (dashboard.css); the shop shows through its logo and name.
  return (
    <div className={`sl-dash ${dmSans.variable}`}>
      <header className="topbar">
        <div className="brand-left">
          <AllPages
            groups={groups}
            locale={locale}
            labels={{ open: t.allPages, title: t.allPagesTitle, hint: t.allPagesHint, language: t.language }}
          />
          <Link href={tabs[0]?.href ?? "/dashboard"} className="brand-link">
            <span className="merchant-logo">
              {me.shop.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded files are served as-is
                <img src={me.shop.logo} alt="" />
              ) : (
                me.shop.name.slice(0, 1)
              )}
            </span>
            <span className="shopname">{me.shop.name}</span>
          </Link>
          <span className="toprole">{roleLabel}</span>
        </div>
        <div className="topright">
          <LanguageToggle locale={locale} className="lang" />
          <a href={`/s/${me.shop.slug}`} target="_blank" rel="noopener" className="storefront-link">
            <DashIcon name="eye" size="sm" />
            {t.viewStorefront}
          </a>
          <SignOutButton label={t.signOut} />
        </div>
      </header>
      <div className="app">
        <SideNav groups={groups} label={t.navMain} />
        <main className="main">{children}</main>
      </div>
      <BottomNav items={tabs} label={t.navMain} />
    </div>
  );
}
