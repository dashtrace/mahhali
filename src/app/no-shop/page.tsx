import { SignOutButton } from "@/components/SignOutButton";
import { ButtonLink } from "@/components/ui";
import { authMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { AuthFrame } from "../_platform/Shell";

// A signed-in user with no shop membership (e.g. their access was removed).
export default async function NoShopPage() {
  const locale = await getLocale();
  const m = authMessages[locale];
  return (
    <AuthFrame locale={locale} icon="bag" center title={m.noShopTitle} subtitle={m.noShopBody}>
      <div className="flex flex-col gap-2">
        <ButtonLink href="/signup" block>
          {m.createShop}
        </ButtonLink>
        <SignOutButton label={common[locale].signOut} className="justify-center" />
      </div>
    </AuthFrame>
  );
}
