import { db, type Db } from "./tx";

type CourierFields = {
  name: string;
  type: "COMPANY" | "INDIVIDUAL";
  phone: string | null;
  active: boolean;
};

// Every function takes shopId and puts it in every where clause.
export const courierRepo = {
  list(shopId: string, opts: { active?: boolean } = {}, client: Db = db) {
    return client.courier.findMany({
      where: { shopId, ...(opts.active === undefined ? {} : { active: opts.active }) },
      orderBy: { name: "asc" },
    });
  },

  findById(shopId: string, id: string, client: Db = db) {
    return client.courier.findFirst({ where: { id, shopId } });
  },

  create(shopId: string, data: Omit<CourierFields, "active">, client: Db = db) {
    return client.courier.create({ data: { ...data, shopId } });
  },

  async update(shopId: string, id: string, data: Partial<CourierFields>, client: Db = db) {
    const { count } = await client.courier.updateMany({ where: { id, shopId }, data });
    return count === 1 ? client.courier.findFirst({ where: { id, shopId } }) : null;
  },
};
