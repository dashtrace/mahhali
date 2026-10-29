import { auth } from "../auth/auth";
import { hashToken, randomToken } from "../domain/tokens";
import { AppError, conflict, notFound } from "../http/errors";
import { json } from "../http/json";
import { rateLimit } from "../http/rateLimit";
import type { Actor } from "../http/withRoute";
import { appUrl, sendMail } from "../mail/mailer";
import { invitationRepo } from "../repositories/invitationRepo";
import { membershipRepo } from "../repositories/membershipRepo";
import { shopRepo } from "../repositories/shopRepo";
import { isUniqueViolation, transaction } from "../repositories/tx";
import type { AcceptInviteInput, InviteInput } from "../validation/team";
import { courierForRole } from "./staffService";

const INVITE_DAYS = 7;

// The emailed token is never stored: the invitation id is its hash. Better Auth's
// own organization endpoints list invitation ids to every member, so a stored
// token would let a staff member accept a manager invite meant for someone else.
async function findOpenInvite(token: string) {
  const invite = await invitationRepo.findById(hashToken(token));
  if (!invite) throw notFound("Invitation");
  if (invite.status !== "pending") throw new AppError(410, "INVITE_USED", "This invitation was already used.");
  if (invite.expiresAt <= new Date()) throw new AppError(410, "INVITE_EXPIRED", "This invitation has expired. Ask the shop owner for a new one.");
  return invite;
}

type AuthBody = { token?: string | null; user?: { id: string; email: string; name: string }; code?: string; message?: string };

export const inviteService = {
  /** Invites someone by email; the link works once and expires in 7 days. */
  async create(actor: Actor, input: InviteInput) {
    if (await membershipRepo.isMember(actor.shopId, input.email)) {
      throw conflict("ALREADY_MEMBER", "This person is already a member of the shop.");
    }
    const courierId = await courierForRole(actor.shopId, input.role, input.courierId);
    const shop = await shopRepo.findById(actor.shopId);
    if (!shop) throw notFound("Shop");

    const token = randomToken();
    const invitation = await transaction((tx) =>
      invitationRepo.replace(tx, actor.shopId, {
        id: hashToken(token),
        email: input.email,
        role: input.role,
        courierId,
        inviterId: actor.userId,
        expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
      }),
    );

    // The owner gets the link back too, to share on WhatsApp if the email does not arrive.
    const link = appUrl(`/invite/${token}`);
    let emailSent = true;
    try {
      await sendMail({
        to: input.email,
        subject: `You're invited to ${shop.name} on Mahhali`,
        text: `Hi,\n\nYou've been invited to join ${shop.name} as ${input.role}. Accept here:\n${link}\n\nThe link works once and expires in ${INVITE_DAYS} days.`,
      });
    } catch (error) {
      console.error("invite email failed", error);
      emailSent = false;
    }
    return {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        courierId: invitation.courierId,
        expiresAt: invitation.expiresAt,
      },
      link,
      emailSent,
    };
  },

  async revoke(actor: Actor, id: string) {
    if (!(await invitationRepo.revoke(actor.shopId, id))) throw notFound("Invitation");
  },

  /** What the invite page shows before the person accepts. */
  async show(token: string) {
    const invite = await findOpenInvite(token);
    return {
      shopName: invite.shop.name,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt,
      // The page asks for a new password, or for the existing one.
      hasAccount: (await invitationRepo.findUserByEmail(invite.email)) !== null,
    };
  },

  /**
   * Accepts an invite: creates the account (or checks the password of the
   * existing one), then adds the membership and marks the invite used in one
   * transaction. Responds with the session cookie, acting in the invited shop.
   */
  async accept(token: string, input: AcceptInviteInput): Promise<Response> {
    // Slows password guessing against an existing account through its invite link.
    rateLimit(`invite-accept:${hashToken(token)}`, 10, 15 * 60 * 1000);
    const invite = await findOpenInvite(token);

    const existing = await invitationRepo.findUserByEmail(invite.email);
    const authResponse = existing
      ? await auth.api.signInEmail({ body: { email: invite.email, password: input.password }, asResponse: true })
      : await auth.api.signUpEmail({ body: { name: input.name, email: invite.email, password: input.password }, asResponse: true });
    const authBody = (await authResponse.json().catch(() => null)) as AuthBody | null;
    if (!authResponse.ok || !authBody?.user || !authBody.token) {
      if (existing) throw new AppError(401, "INVALID_PASSWORD", "Wrong password for this account.");
      throw new AppError(authResponse.status, authBody?.code ?? "SIGNUP_FAILED", authBody?.message ?? "Could not create the account.");
    }
    const user = authBody.user;
    const sessionToken = authBody.token;

    try {
      await transaction(async (tx) => {
        if (!(await invitationRepo.markAccepted(tx, invite.shopId, invite.id, new Date()))) {
          throw new AppError(410, "INVITE_USED", "This invitation was already used.");
        }
        await membershipRepo.create(
          { shopId: invite.shopId, userId: user.id, role: invite.role ?? "staff", courierId: invite.courierId },
          tx,
        );
        await membershipRepo.setActiveShop(user.id, sessionToken, invite.shopId, tx);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict("ALREADY_MEMBER", "You are already a member of this shop.");
      throw error;
    }

    const headers = new Headers();
    for (const cookie of authResponse.headers.getSetCookie()) headers.append("set-cookie", cookie);
    return json(
      {
        user: { id: user.id, email: user.email, name: user.name },
        shop: { id: invite.shopId, name: invite.shop.name, slug: invite.shop.slug },
        role: invite.role,
      },
      200,
      headers,
    );
  },
};
