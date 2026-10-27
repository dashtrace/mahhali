import type { Metadata } from "next";
import { authMessages } from "@/i18n/messages/auth";
import { getLocale } from "@/i18n/server";
import { AuthFrame, TextLink } from "../_platform/Shell";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = await getLocale();
  const m = authMessages[locale];
  const { next } = await searchParams;
  // Only ever return to a path on this site.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return (
    <AuthFrame
      locale={locale}
      title={m.signInTitle}
      subtitle={m.signInSubtitle}
      footer={
        <>
          {m.noAccount} <TextLink href="/signup">{m.createShop}</TextLink>
        </>
      }
    >
      <LoginForm m={m} next={safeNext} />
    </AuthFrame>
  );
}
