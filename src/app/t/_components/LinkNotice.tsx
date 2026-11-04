import { Icon, type IconName } from "@/components/Icon";
import { ButtonLink, cx } from "@/components/ui";
import { dirOf, type Locale } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { dmSans, playfair } from "../../_storefront/fonts";

/**
 * A customer link that can't open (used, expired, rate limited). There is no
 * shop to dress it in, so it uses the platform tokens in the storefront's panel style.
 */
export function LinkNotice({ locale, title, body, icon = "info" }: { locale: Locale; title: string; body?: string; icon?: IconName }) {
  return (
    <main
      lang={locale}
      dir={dirOf(locale)}
      style={{ fontFamily: "var(--font-shop)" }}
      className={cx(playfair.variable, dmSans.variable, "sl-shop grid min-h-dvh place-items-center bg-sl-bg px-4 py-16 text-sl-fg")}
    >
      <div className="sl-order-panel sl-link-notice">
        <span aria-hidden className="sl-review-done-icon">
          <Icon name={icon} className="size-7" />
        </span>
        <h1>{title}</h1>
        {body && <p>{body}</p>}
        <ButtonLink href="/" tone="secondary" className="sl-action">
          {common[locale].appName}
        </ButtonLink>
      </div>
    </main>
  );
}
