import { SignOutButton } from "@/components/SignOutButton";
import { ButtonLink } from "@/components/ui";
import { authMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";

// A signed-in user with no shop membership (e.g. their access was removed).
export default async function NoShopPage() {
  const locale = await getLocale();
  const m = authMessages[locale];
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">{m.noShopTitle}</h1>
      <p className="text-stone-600">{m.noShopBody}</p>
      <ButtonLink href="/signup">{m.createShop}</ButtonLink>
      <SignOutButton label={common[locale].signOut} className="justify-center" />
    </main>
  );
}
