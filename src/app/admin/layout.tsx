import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { adminMessages } from "@/i18n/messages/admin";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
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
    <div style={themeVars(null, "chrome")} className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
          <Link href="/admin" className="flex min-h-11 items-center gap-2 font-semibold">
            <Icon name="shield" />
            <span className="hidden sm:inline">{m.title}</span>
          </Link>
          <nav aria-label={m.title} className="flex">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm font-medium text-stone-700 hover:bg-stone-100">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center">
            <LanguageToggle locale={locale} />
            <SignOutButton label={t.signOut} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4 pb-10">{children}</main>
    </div>
  );
}
