import { notFound } from "../http/errors";
import { adminRepo } from "../repositories/adminRepo";
import { shopRepo } from "../repositories/shopRepo";

// Platform admins: read-only views across shops, plus suspend. withRoute has
// already checked the admin role and written the audit row.
export const adminService = {
  async listShops(q?: string) {
    const shops = await adminRepo.listShops(q);
    return shops.map(({ _count, ...shop }) => ({
      ...shop,
      counts: { members: _count.memberships, products: _count.products, orders: _count.orders },
    }));
  },

  async getShop(id: string) {
    const shop = await adminRepo.findShop(id);
    if (!shop) throw notFound("Shop");
    const { _count, memberships, ...rest } = shop;
    return {
      ...rest,
      counts: { members: _count.memberships, products: _count.products, orders: _count.orders, couriers: _count.couriers },
      members: memberships,
    };
  },

  async shopOrders(id: string, cursor?: string) {
    if (!(await shopRepo.findById(id))) throw notFound("Shop");
    return adminRepo.shopOrders(id, cursor);
  },

  async suspend(id: string, suspended: boolean) {
    if (!(await adminRepo.setSuspended(id, suspended))) throw notFound("Shop");
    return { id, suspended };
  },

  auditLog(cursor?: string) {
    return adminRepo.auditLog(cursor);
  },
};
