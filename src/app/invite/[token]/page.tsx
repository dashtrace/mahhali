import type { Metadata } from "next";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Alert, ButtonLink } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { inviteService } from "@/server/services/inviteService";
import { TokenParam } from "@/server/validation/team";
import { signedInUser } from "../../_server/session";
import { AcceptForm } from "./AcceptForm";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const locale = await getLocale();
  const m = shopMessages[locale];
  const t = common[locale];

  let invite: Awaited<ReturnType<typeof inviteService.show>> | null = null;
  let problem = m.inviteNotFound;
  if (TokenParam.safeParse({ token }).success) {
    try {
      invite = await inviteService.show(token);
    } catch (e) {
      if (!(e instanceof AppError)) throw e;
      problem = e.code === "INVITE_USED" ? m.inviteUsed : e.code === "INVITE_EXPIRED" ? m.inviteExpired : m.inviteNotFound;
    }
  }
  const user = invite ? await signedInUser() : null;
  const role = invite ? ({ manager: t.roleManager, staff: t.roleStaff, delivery: t.roleDelivery }[invite.role ?? ""] ?? invite.role ?? "") : "";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold text-[var(--brand)]">
          {t.appName}
        </Link>
        <LanguageToggle locale={locale} />
      </div>
      {invite ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold">{fill(m.joinShop, { shop: invite.shopName })}</h1>
            <p className="mt-1 text-sm text-stone-600">{fill(m.invitedAs, { role, email: invite.email })}</p>
          </div>
          {user && user.email !== invite.email && <Alert tone="warning">{fill(m.signedInAs, { email: user.email, invited: invite.email })}</Alert>}
          <AcceptForm token={token} hasAccount={invite.hasAccount} m={m} t={t} />
        </>
      ) : (
        <>
          <Alert tone="error">{problem}</Alert>
          <ButtonLink href="/login" tone="secondary">
            {m.goToSignIn}
          </ButtonLink>
        </>
      )}
    </main>
  );
}
