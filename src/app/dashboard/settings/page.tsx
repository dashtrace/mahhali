import { PageHeader } from "@/components/ui";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { plain } from "@/server/http/json";
import { appUrl } from "@/server/mail/mailer";
import { shopService } from "@/server/services/shopService";
import { pageActor } from "../../_server/session";
import { readTheme } from "../../_server/theme";
import { Branding } from "./_components/Branding";
import { SettingsForm } from "./_components/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const actor = await pageActor("shop.settings", "/dashboard/settings");
  const locale = await getLocale();
  const m = shopMessages[locale];
  const t = common[locale];
  const [settings, branding] = await Promise.all([shopService.settings(actor), shopService.branding(actor)]);
  return (
    <>
      <PageHeader title={m.settingsTitle} />
      <div className="flex flex-col gap-4">
        <SettingsForm settings={plain(settings)} catalogueUrl={appUrl(`/s/${settings.slug}`)} m={m} t={t} />
        <Branding theme={readTheme(branding.theme)} logo={branding.logo} m={m} t={t} />
      </div>
    </>
  );
}
