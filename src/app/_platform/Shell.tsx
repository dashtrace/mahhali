import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cx } from "@/components/ui";
import type { Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";

// The platform's public chrome (landing, pricing, auth, 404): the wordmark,
// a language switch, and the owner-panel card the mockup uses for settings.

export function BrandLink({ locale }: { locale: Locale }) {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5">
      <span aria-hidden className="grid size-10 place-items-center rounded-sl bg-sl-accent text-sl-accent-ink">
        <Icon name="bag" />
      </span>
      <span className="sl-heading text-lg">{common[locale].appName}</span>
    </Link>
  );
}

export function PlatformHeader({ locale, children, className }: { locale: Locale; children?: ReactNode; className?: string }) {
  return (
    <header className={cx("mx-auto flex h-[60px] w-full max-w-5xl items-center gap-1 px-4", className)}>
      <BrandLink locale={locale} />
      <div className="ms-auto flex items-center gap-1">
        {children}
        <LanguageToggle locale={locale} />
      </div>
    </header>
  );
}

/** A centred card for one-task pages: sign in, sign up, invites, dead ends. */
export function AuthFrame({
  locale,
  title,
  subtitle,
  eyebrow,
  icon,
  wide,
  center,
  children,
  footer,
}: {
  locale: Locale;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  icon?: IconName;
  wide?: boolean;
  center?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-sl-bg">
      <PlatformHeader locale={locale} />
      <main className={cx("mx-auto flex w-full flex-1 flex-col justify-center px-4 pb-12 pt-4", wide ? "max-w-lg" : "max-w-sm")}>
        <div className={cx("rounded-[18px] border border-sl-border bg-sl-panel p-5 shadow-[0_4px_20px_#2130400a] sm:p-6", center && "text-center")}>
          {icon && (
            <span aria-hidden className={cx("mb-4 grid size-12 place-items-center rounded-full bg-sl-cat text-sl-accent", center && "mx-auto")}>
              <Icon name={icon} />
            </span>
          )}
          {eyebrow && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.17em] text-sl-accent rtl:tracking-normal">{eyebrow}</p>}
          <h1 className="sl-heading text-[26px] leading-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm leading-relaxed text-sl-muted">{subtitle}</p>}
          {children && <div className="mt-5">{children}</div>}
        </div>
        {footer && <div className="mt-4 text-center text-sm text-sl-muted">{footer}</div>}
      </main>
    </div>
  );
}

/** The accent text link used under auth cards ("New here? Create your shop"). */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center font-bold text-sl-accent underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
