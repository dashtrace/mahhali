import { ButtonLink } from "@/components/ui";
import { marketingMessages } from "@/i18n/messages/auth";
import { getLocale } from "@/i18n/server";
import { AuthFrame } from "./_platform/Shell";

export default async function NotFound() {
  const locale = await getLocale();
  const m = marketingMessages[locale];
  return (
    <AuthFrame locale={locale} icon="search" center eyebrow={m.notFoundEyebrow} title={m.notFoundTitle} subtitle={m.notFoundBody}>
      <ButtonLink href="/" block>
        {m.notFoundHome}
      </ButtonLink>
    </AuthFrame>
  );
}
