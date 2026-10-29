import type { Metadata } from "next";
import { Alert, ButtonLink } from "@/components/ui";
import { fill } from "@/i18n/locale";
import { common } from "@/i18n/messages/common";
import { shopMessages } from "@/i18n/messages/shop";
import { getLocale } from "@/i18n/server";
import { AppError } from "@/server/http/errors";
import { inviteService } from "@/server/services/inviteService";
import { TokenParam } from "@/server/validation/team";
import { AuthFrame } from "../../_platform/Shell";
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

  if (!invite)
    return (
      <AuthFrame locale={locale} icon="x" center title={problem}>
        <ButtonLink href="/login" tone="secondary" block>
          {m.goToSignIn}
        </ButtonLink>
      </AuthFrame>
    );

  return (
    <AuthFrame locale={locale} icon="users" title={fill(m.joinShop, { shop: invite.shopName })} subtitle={fill(m.invitedAs, { role, email: invite.email })}>
      <div className="flex flex-col gap-4">
        {user && user.email !== invite.email && <Alert tone="warning">{fill(m.signedInAs, { email: user.email, invited: invite.email })}</Alert>}
        <AcceptForm token={token} hasAccount={invite.hasAccount} m={m} t={t} />
      </div>
    </AuthFrame>
  );
}
