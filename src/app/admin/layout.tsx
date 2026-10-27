import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { TopLinks } from "../dashboard/_components/Nav";
import { pageAdmin } from "../_server/session";
import { themeVars } from "../_server/theme";

export const metadata = { title: { default: "Admin", template: "%s · Admin · Mahhali" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await pageAdmin();
  const locale = await getLocale();
  const m = adminMessages[locale];
  const t = common[locale];
  const links = [
    { href: "/admin", label: m.shops },
    { href: "/admin/audit", label: m.auditLog },
  ];
  return (
    <div style={themeVars(null, "chrome")} className="min-h-dvh bg-sl-bg">
      <header className="sticky top-0 z-20 border-b border-sl-border bg-sl-panel/95 backdrop-blur">
        {/* Phones: brand and account on the first row, the section links on a second. */}
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 px-4 py-2 sm:h-[60px] sm:flex-nowrap sm:py-0">
          <Link href="/admin" className="flex min-h-11 items-center gap-2.5 font-extrabold tracking-tight">
            <span className="grid size-10 place-items-center rounded-sl bg-sl-accent text-sl-accent-ink">
              <Icon name="shield" />
            </span>
            <span className="whitespace-nowrap">{m.title}</span>
          </Link>
          <div className="order-last -mx-3 w-[calc(100%+1.5rem)] sm:order-none sm:mx-0 sm:w-auto">
            <TopLinks items={links} label={m.title} />
          </div>
          <div className="ms-auto flex items-center">
            <LanguageToggle locale={locale} className="whitespace-nowrap" />
            <SignOutButton label={t.signOut} className="whitespace-nowrap" />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4 pb-10">{children}</main>
    </div>
  );
}
