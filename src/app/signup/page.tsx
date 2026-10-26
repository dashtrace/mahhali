import type { Metadata } from "next";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { authMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create your shop" };

export default async function SignupPage() {
  const locale = await getLocale();
  const m = authMessages[locale];
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-[var(--brand)]">
          {common[locale].appName}
        </Link>
        <LanguageToggle locale={locale} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{m.signUpTitle}</h1>
        <p className="mt-1 text-sm text-stone-600">{m.signUpSubtitle}</p>
      </div>
      <SignupForm m={m} />
      <p className="text-sm text-stone-600">
        {m.haveAccount}{" "}
        <Link href="/login" className="font-medium text-[var(--brand)] underline-offset-4 hover:underline">
          {common[locale].signIn}
        </Link>
      </p>
    </main>
  );
}
