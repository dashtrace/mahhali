import { Icon, type IconName } from "@/components/Icon";
import { ButtonLink } from "@/components/ui";
import { dirOf, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";

/**
 * A customer link that can't open (used, expired, rate limited). There is no
 * shop to dress it in, so it uses the platform tokens in the storefront's card style.
 */
export function LinkNotice({ locale, title, body, icon = "info" }: { locale: Locale; title: string; body?: string; icon?: IconName }) {
  return (
    <main lang={locale} dir={dirOf(locale)} className="grid min-h-dvh place-items-center bg-sl-bg px-4 py-16 text-sl-fg">
      <div className="w-full max-w-sm rounded-[17px] border border-sl-border bg-sl-panel p-6 text-center shadow-[0_7px_20px_#00000005]">
        <span aria-hidden className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-sl-cat text-sl-accent">
          <Icon name={icon} className="size-7" />
        </span>
        <h1 className="sl-heading text-2xl leading-tight">{title}</h1>
        {body && <p className="mt-2 text-sm leading-normal text-sl-muted">{body}</p>}
        <ButtonLink href="/" tone="secondary" className="mt-5">
          {common[locale].appName}
        </ButtonLink>
      </div>
    </main>
  );
}
