import { PageHeader, Segmented } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { MAX_SLIDES } from "@/server/domain/storefront";
import { plain } from "@/server/http/json";
import { appUrl } from "@/server/mail/mailer";
import { shopService } from "@/server/services/shopService";
import { storefrontService } from "@/server/services/storefrontService";
import { pageActor } from "../../_server/session";
import { readTheme } from "../../_server/theme";
import { Branding } from "./_components/Branding";
import { SettingsForm } from "./_components/SettingsForm";
import { SlidesEditor } from "./_components/SlidesEditor";
import { StorefrontForm } from "./_components/StorefrontForm";

export const metadata = { title: "Settings" };

const TABS = ["general", "storefront", "slides", "branding"] as const;
type Tab = (typeof TABS)[number];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await pageActor("shop.settings", "/dashboard/settings");
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.find((x) => x === raw) ?? "general";
  const locale = await getLocale();
  const m = shopMessages[locale];
  const t = common[locale];
  const labels: Record<Tab, string> = { general: m.tabGeneral, storefront: m.tabStorefront, slides: m.tabSlides, branding: m.tabBranding };

  return (
    <>
      <PageHeader title={m.settingsTitle} />
      <Segmented
        label={m.settingsSections}
        className="mb-4 max-w-xl"
        items={TABS.map((x) => ({ label: labels[x], href: x === "general" ? "/dashboard/settings" : `/dashboard/settings?tab=${x}`, current: x === tab }))}
      />
      <div className="flex flex-col gap-4">{await section(tab)}</div>
    </>
  );

  async function section(tab: Tab) {
    if (tab === "general") {
      const settings = await shopService.settings(actor);
      return <SettingsForm settings={plain(settings)} catalogueUrl={appUrl(`/s/${settings.slug}`)} m={m} t={t} />;
    }
    if (tab === "storefront") {
      const [storefront, settings] = await Promise.all([storefrontService.settings(actor), shopService.settings(actor)]);
      return <StorefrontForm storefront={storefront} whatsappPhone={settings.whatsappPhone} m={m} t={t} />;
    }
    if (tab === "slides") {
      const [slides, branding] = await Promise.all([storefrontService.slides(actor), shopService.branding(actor)]);
      return <SlidesEditor slides={slides} theme={readTheme(branding.theme)} max={MAX_SLIDES} m={m} t={t} />;
    }
    const [branding, settings, storefront] = await Promise.all([shopService.branding(actor), shopService.settings(actor), storefrontService.settings(actor)]);
    return (
      <Branding
        theme={readTheme(branding.theme)}
        logo={branding.logo}
        shop={{ name: settings.name, currency: settings.currency, logoMode: storefront.logoMode, tagline: storefront.tagline }}
        locale={locale}
        m={m}
        t={t}
      />
    );
  }
}
