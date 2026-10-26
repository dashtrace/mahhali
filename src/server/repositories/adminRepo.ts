import { db, type Db } from "./tx";

const PAGE = 50;

/** Cursor paging on id, newest first: one extra row tells whether there is a next page. */
function page<T extends { id: string }>(rows: T[]) {
  const items = rows.slice(0, PAGE);
  return { items, nextCursor: rows.length > PAGE ? items[items.length - 1].id : null };
}

const after = (cursor?: string) => ({ cursor: cursor ? { id: cursor } : undefined, skip: cursor ? 1 : 0 });

// The only repository allowed to query across shops. Used by /api/admin/* alone.
export const adminRepo = {
  audit(adminUserId: string, action: string, shopId: string | null, client: Db = db) {
    return client.adminAuditLog.create({ data: { adminUserId, action, shopId } });
  },

  // shortcut: returns the 100 newest matches; add cursor paging once the platform has more shops.
  listShops(q: string | undefined, client: Db = db) {
    return client.shop.findMany({
      where: q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q, mode: "insensitive" } }] }
        : {},
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        suspended: true,
        createdAt: true,
        _count: { select: { memberships: true, products: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  },

  findShop(id: string, client: Db = db) {
    return client.shop.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true, products: true, orders: true, couriers: true } },
        memberships: {
          select: {
            id: true,
            role: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
            courier: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  },

  async shopOrders(shopId: string, cursor: string | undefined, client: Db = db) {
    const rows = await client.order.findMany({
      where: { shopId },
      select: {
        id: true,
        number: true,
        status: true,
        source: true,
        customerName: true,
        area: true,
        currency: true,
        totalMinor: true,
        createdAt: true,
        deliveredAt: true,
        courier: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...after(cursor),
    });
    return page(rows);
  },

  async setSuspended(id: string, suspended: boolean, client: Db = db) {
    const { count } = await client.shop.updateMany({ where: { id }, data: { suspended } });
    return count === 1;
  },

  async auditLog(cursor: string | undefined, client: Db = db) {
    const rows = await client.adminAuditLog.findMany({
      select: { id: true, action: true, shopId: true, at: true, admin: { select: { id: true, name: true, email: true } } },
      orderBy: [{ at: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...after(cursor),
    });
    return page(rows);
  },
};
