import type { Metadata } from "next";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { authMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getLocale();
  const m = authMessages[locale];
  const { next } = await searchParams;
  // Only ever return to a path on this site.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-[var(--brand)]">
          {common[locale].appName}
        </Link>
        <LanguageToggle locale={locale} />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{m.signInTitle}</h1>
        <p className="mt-1 text-sm text-stone-600">{m.signInSubtitle}</p>
      </div>
      <LoginForm m={m} next={safeNext} />
      <p className="text-sm text-stone-600">
        {m.noAccount}{" "}
        <Link href="/signup" className="font-medium text-[var(--brand)] underline-offset-4 hover:underline">
          {m.createShop}
        </Link>
      </p>
    </main>
  );
}
