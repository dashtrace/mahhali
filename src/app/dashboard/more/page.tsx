import Link from "next/link";
import { Icon } from "@/components/Icon";
import { SignOutButton } from "@/components/SignOutButton";
import { PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { can } from "@/server/domain/policy";
import { pageActor } from "../../_server/session";

// Phones only: the sections that do not fit in the bottom bar.
export default async function MorePage() {
  const actor = await pageActor("order.readAssigned");
  const t = common[await getLocale()];
  const links = [
    { href: "/dashboard/couriers", label: t.navCouriers, icon: "users", ok: can(actor.role, "courier.read") },
    { href: "/dashboard/metrics", label: t.navMetrics, icon: "chart", ok: can(actor.role, "metrics.read") },
    { href: "/dashboard/reviews", label: t.navReviews, icon: "star", ok: can(actor.role, "review.read") },
    { href: "/dashboard/staff", label: t.navStaff, icon: "users", ok: can(actor.role, "staff.manage") },
    { href: "/dashboard/settings", label: t.navSettings, icon: "gear", ok: can(actor.role, "shop.settings") },
    { href: "/dashboard/billing", label: t.navBilling, icon: "card", ok: can(actor.role, "billing.manage") },
  ] as const;
  return (
    <>
      <PageHeader title={t.navMore} />
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-[var(--radius)] border border-stone-200 bg-white">
        {links
          .filter((l) => l.ok)
          .map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-14 items-center gap-3 px-4 font-medium hover:bg-stone-50">
                <Icon name={l.icon} />
                {l.label}
              </Link>
            </li>
          ))}
      </ul>
      <SignOutButton label={t.signOut} className="mt-4 w-full justify-center border border-stone-200 bg-white" />
    </>
  );
}
