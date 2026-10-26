import { describe, expect, it } from "vitest";
import { ACTIONS, can, isShopRole, type Action, type ShopRole } from "@/server/domain/policy";

// The roles table from the build plan, row by row.
const expected: Record<Action, ShopRole[]> = {
  "order.read": ["owner", "manager", "staff"],
  "order.readAssigned": ["owner", "manager", "staff", "delivery"],
  "order.create": ["owner", "manager", "staff"],
  "order.transition": ["owner", "manager", "staff"],
  "order.assignCourier": ["owner", "manager", "staff"],
  "order.markDelivered": ["owner", "manager", "staff", "delivery"],
  "product.read": ["owner", "manager", "staff"],
  "product.write": ["owner", "manager"],
  "stock.adjust": ["owner", "manager"],
  "courier.read": ["owner", "manager", "staff"],
  "courier.write": ["owner", "manager"],
  "remittance.write": ["owner", "manager"],
  "reconciliation.read": ["owner", "manager"],
  "metrics.read": ["owner", "manager"],
  "review.read": ["owner", "manager", "staff"],
  "review.moderate": ["owner", "manager"],
  "shop.settings": ["owner"],
  "staff.manage": ["owner"],
  "billing.manage": ["owner"],
};

describe("can(role, action)", () => {
  it("covers every action in the policy", () => {
    expect(ACTIONS.sort()).toEqual(Object.keys(expected).sort());
  });

  for (const [action, allowed] of Object.entries(expected) as [Action, ShopRole[]][]) {
    for (const role of ["owner", "manager", "staff", "delivery"] as ShopRole[]) {
      it(`${role} ${allowed.includes(role) ? "may" : "may not"} ${action}`, () => {
        expect(can(role, action)).toBe(allowed.includes(role));
      });
    }
  }

  it("delivery users can only see assigned orders and mark them delivered", () => {
    const deliveryActions = ACTIONS.filter((a) => can("delivery", a));
    expect(deliveryActions.sort()).toEqual(["order.markDelivered", "order.readAssigned"]);
  });
});

describe("isShopRole", () => {
  it("accepts the four shop roles only", () => {
    expect(["owner", "manager", "staff", "delivery"].every(isShopRole)).toBe(true);
    expect(isShopRole("admin")).toBe(false);
    expect(isShopRole("member")).toBe(false);
    expect(isShopRole(undefined)).toBe(false);
  });
});
