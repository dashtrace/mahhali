import { Notice } from "@/app/_storefront/ShopFrame";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";

/** The owner's shop can't be shown, for example while it is suspended. */
export default async function PreviewUnavailable() {
  const locale = await getLocale();
  const m = shopMessages[locale];
  return <Notice locale={locale} title={m.previewUnavailable} body={m.previewUnavailableBody} />;
}
