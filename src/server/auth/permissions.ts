import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, memberAc } from "better-auth/plugins/organization/access";

// Better Auth needs these to validate invitations and role changes.
// What each role may do inside Shop Link is decided by domain/policy.ts.
export const ac = createAccessControl({ ...defaultStatements });

export const owner = ac.newRole({ ...adminAc.statements, organization: ["update", "delete"] });
export const manager = ac.newRole({ ...memberAc.statements });
export const staff = ac.newRole({ ...memberAc.statements });
export const delivery = ac.newRole({ ...memberAc.statements });

export const shopRoles = { owner, manager, staff, delivery };
