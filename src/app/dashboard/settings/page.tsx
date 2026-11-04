import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { MAX_SLIDES } from "@/server/domain/storefront";
import { plain } from "@/server/http/json";
import { appUrl } from "@/server/mail/mailer";
import { shopService } from "@/server/services/shopService";
import { categoryService, storefrontService } from "@/server/services/storefrontService";
import { pageActor } from "../../_server/session";
import { readTheme } from "../../_server/theme";
import { Branding } from "./_components/Branding";
import { LivePreview, PreviewButton } from "./_components/LivePreview";
import { SettingsForm } from "./_components/SettingsForm";
import { SlidesEditor } from "./_components/SlidesEditor";
import { StorefrontForm } from "./_components/StorefrontForm";
import "./settings.css";

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
    <LivePreview
      key={tab}
      locale={locale}
      m={m}
      head={
        <>
          <PageHeader title={m.settingsTitle} subtitle={m.settingsSubtitle} actions={<PreviewButton label={m.previewChanges} />} />
          <nav aria-label={m.settingsSections} className="pills settings-tabs">
            {TABS.map((x) => (
              <Link key={x} href={x === "general" ? "/dashboard/settings" : `/dashboard/settings?tab=${x}`} aria-current={x === tab ? "page" : undefined} className="pill">
                {labels[x]}
              </Link>
            ))}
          </nav>
        </>
      }
    >
      {await section(tab)}
    </LivePreview>
  );

  async function section(tab: Tab) {
    if (tab === "general") {
      const settings = await shopService.settings(actor);
      return <SettingsForm settings={plain(settings)} catalogueUrl={appUrl(`/s/${settings.slug}`)} m={m} t={t} />;
    }
    if (tab === "storefront") {
      const [storefront, settings, categories] = await Promise.all([storefrontService.settings(actor), shopService.settings(actor), categoryService.list(actor)]);
      return <StorefrontForm storefront={storefront} categories={categories} whatsappPhone={settings.whatsappPhone} m={m} t={t} />;
    }
    if (tab === "slides") {
      return <SlidesEditor slides={await storefrontService.slides(actor)} max={MAX_SLIDES} m={m} t={t} />;
    }
    const branding = await shopService.branding(actor);
    return <Branding theme={readTheme(branding.theme)} logo={branding.logo} m={m} t={t} />;
  }
}
