import type { Metadata } from "next";
import { Alert } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { photoMessages } from "@/i18n/messages/photos";
import { getLocale } from "@/i18n/server";
import { formatDateTime } from "@/lib/format";
import { AppError } from "@/server/http/errors";
import { plain } from "@/server/http/json";
import { photoLinkService } from "@/server/services/photoLinkService";
import { AuthFrame } from "../../_platform/Shell";
import { requestIp } from "../../_server/session";
import { PhotoUploader } from "./PhotoUploader";

export const metadata: Metadata = { title: "Add photos", robots: { index: false } };

type Props = { params: Promise<{ token: string }> };

// "Add photos" page an AI assistant links to after a product import: no login,
// the link itself is the key (24 hours, that import's products only).
export default async function AddPhotosPage({ params }: Props) {
  const { token } = await params;
  const locale = await getLocale();
  const m = photoMessages[locale];

  let data;
  try {
    data = plain(await photoLinkService.forToken(token, await requestIp()));
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return (
      <AuthFrame locale={locale} icon="info" center title={m.unavailableTitle}>
        <Alert tone="error">{error.status === 429 ? m.rateLimited : m.linkDead}</Alert>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      locale={locale}
      wide
      icon="plus"
      title={m.title}
      subtitle={fill(m.subtitle, { shop: data.shop.name })}
      footer={fill(m.expires, { date: formatDateTime(data.expiresAt, locale) })}
    >
      {data.products.length === 0 ? (
        <Alert tone="info">{m.noProducts}</Alert>
      ) : (
        <PhotoUploader token={token} products={data.products} max={data.maxPhotosPerProduct} m={m} />
      )}
    </AuthFrame>
  );
}
