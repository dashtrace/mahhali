import { db, type Db } from "./tx";

// All lookup and mutation predicates include the active tenant.
export const collectionRepo = {
  find(shopId: string, id: string, tx: Db = db) {
    return tx.productCollection.findFirst({ where: { shopId, id } });
  },
  list(shopId: string, categoryId: string, tx: Db) {
    return tx.productCollection.findMany({ where: { shopId, categoryId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  },
  create(shopId: string, categoryId: string, name: string, position: number, tx: Db) {
    return tx.productCollection.create({ data: { shopId, categoryId, name, position } });
  },
  update(shopId: string, id: string, data: { name?: string; position?: number }, tx: Db) {
    return tx.productCollection.updateMany({ where: { shopId, id }, data });
  },
  async delete(shopId: string, id: string, tx: Db) {
    // Keep the category, clearing both lower references before deleting sections.
    await tx.product.updateMany({
      where: { shopId, collectionId: id },
      data: { collectionId: null, sectionId: null },
    });
    return tx.productCollection.deleteMany({ where: { shopId, id } });
  },
};
export const sectionRepo = {
  find(shopId: string, id: string, tx: Db = db) {
    return tx.productSection.findFirst({ where: { shopId, id } });
  },
  list(shopId: string, collectionId: string, tx: Db) {
    return tx.productSection.findMany({ where: { shopId, collectionId }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  },
  create(shopId: string, collectionId: string, name: string, position: number, tx: Db) {
    return tx.productSection.create({ data: { shopId, collectionId, name, position } });
  },
  update(shopId: string, id: string, data: { name?: string; position?: number }, tx: Db) {
    return tx.productSection.updateMany({ where: { shopId, id }, data });
  },
  delete(shopId: string, id: string, tx: Db) {
    return tx.productSection.deleteMany({ where: { shopId, id } });
  },
};
