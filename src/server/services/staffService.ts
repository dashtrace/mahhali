import { auth } from "../auth/auth";
import { notFound, unprocessable } from "../http/errors";
import type { Actor } from "../http/withRoute";
import { invitationRepo } from "../repositories/invitationRepo";
import { membershipRepo } from "../repositories/membershipRepo";
import { transaction } from "../repositories/tx";
import type { UpdateMemberInput } from "../validation/team";

/**
 * Delivery users act for one of the shop's couriers; other roles have none.
 * Shared by invites and role changes.
 */
export async function courierForRole(shopId: string, role: string, courierId: string | null | undefined) {
  if (role !== "delivery") return null;
  if (!courierId) throw unprocessable("COURIER_REQUIRED", "Pick the courier this delivery user works for.");
  if (!(await membershipRepo.courierExists(shopId, courierId))) throw notFound("Courier");
  return courierId;
}

function protectOwner(actor: Actor, member: { role: string; userId: string }) {
  if (member.role === "owner" || member.userId === actor.userId) {
    throw unprocessable("OWNER_PROTECTED", "The owner's access cannot be changed or removed.");
  }
}

type MemberRow = NonNullable<Awaited<ReturnType<typeof membershipRepo.findById>>>;

const toMember = (m: MemberRow) => ({
  id: m.id,
  userId: m.userId,
  name: m.user.name,
  email: m.user.email,
  role: m.role,
  courier: m.courier,
  createdAt: m.createdAt,
});

export const staffService = {
  /** Members and pending invitations, for the team screen. */
  async list(actor: Actor) {
    const [members, invitations] = await Promise.all([
      membershipRepo.list(actor.shopId),
      invitationRepo.listPending(actor.shopId),
    ]);
    return { members: members.map(toMember), invitations };
  },

  async update(actor: Actor, membershipId: string, input: UpdateMemberInput) {
    const member = await membershipRepo.findById(actor.shopId, membershipId);
    if (!member) throw notFound("Member");
    protectOwner(actor, member);
    const role = input.role ?? member.role;
    const courierId = await courierForRole(actor.shopId, role, input.courierId === undefined ? member.courierId : input.courierId);
    if (!(await membershipRepo.update(actor.shopId, membershipId, { role, courierId }))) throw notFound("Member");
    const updated = await membershipRepo.findById(actor.shopId, membershipId);
    if (!updated) throw notFound("Member");
    return toMember(updated);
  },

  async remove(actor: Actor, membershipId: string) {
    const member = await membershipRepo.findById(actor.shopId, membershipId);
    if (!member) throw notFound("Member");
    protectOwner(actor, member);
    if (!(await transaction((tx) => membershipRepo.remove(tx, actor.shopId, membershipId, member.userId)))) {
      throw notFound("Member");
    }
  },

  /** Every shop the signed-in user works for, with the one they are acting in marked. */
  async myShops(actor: Actor) {
    const memberships = await membershipRepo.listForUser(actor.userId);
    return memberships.map((m) => ({
      shopId: m.shop.id,
      name: m.shop.name,
      slug: m.shop.slug,
      logo: m.shop.logo,
      suspended: m.shop.suspended,
      role: m.role,
      active: m.shop.id === actor.shopId,
    }));
  },

  /** Switches the session to another shop the user belongs to; any other id is "not found". */
  async switchShop(actor: Actor, shopId: string, headers: Headers) {
    const membership = await membershipRepo.findActive(actor.userId, shopId);
    if (!membership) throw notFound("Shop");
    await auth.api.setActiveOrganization({ headers, body: { organizationId: shopId } });
    return { shopId, role: membership.role };
  },
};
