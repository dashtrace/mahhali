import type { Metadata } from "next";
import { authMessages } from "@/i18n/messages/auth";
import { common } from "@/i18n/messages/common";
import { getLocale } from "@/i18n/server";
import { AuthFrame, TextLink } from "../_platform/Shell";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = { title: "Create your shop" };

export default async function SignupPage() {
  const locale = await getLocale();
  const m = authMessages[locale];
  return (
    <AuthFrame
      locale={locale}
      wide
      title={m.signUpTitle}
      subtitle={m.signUpSubtitle}
      footer={
        <>
          {m.haveAccount} <TextLink href="/login">{common[locale].signIn}</TextLink>
        </>
      }
    >
      <SignupForm m={m} />
    </AuthFrame>
  );
}
