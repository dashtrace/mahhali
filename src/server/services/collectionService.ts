import type { Actor } from "../http/withRoute";
import { notFound, unprocessable } from "../http/errors";
import { collectionRepo, sectionRepo } from "../repositories/collectionRepo";
import { categoryRepo, lockShop } from "../repositories/storefrontRepo";
import { transaction, isUniqueViolation } from "../repositories/tx";
import { moveTo } from "../domain/storefront";

// A small fixed depth: category -> collection -> section. No new level is mandatory.
const MAX_CHILDREN = 30;
async function unique<T>(fn: () => Promise<T>) {
  try { return await fn(); }
  catch (e) {
    if (isUniqueViolation(e)) throw unprocessable("DUPLICATE_COLLECTION", "This name already exists under this parent.");
    throw e;
  }
}
export const collectionService = {
  create(actor: Actor, parentId: string, name: string, section = false) {
    return unique(() => transaction(async (tx) => {
      await lockShop(tx, actor.shopId);
      const repo = section ? sectionRepo : collectionRepo;
      const parent = section ? await collectionRepo.find(actor.shopId, parentId, tx) : await categoryRepo.findById(actor.shopId, parentId, tx);
      if (!parent) throw notFound(section ? "Collection" : "Category");
      const siblings = await repo.list(actor.shopId, parentId, tx);
      if (siblings.length >= MAX_CHILDREN) throw unprocessable("COLLECTION_LIMIT", "At most 30 items are allowed under one parent.");
      return repo.create(actor.shopId, parentId, name, (siblings.at(-1)?.position ?? -1) + 1, tx);
    }));
  },
  update(actor: Actor, id: string, input: { name?: string; position?: number }, section = false) {
    return unique(() => transaction(async (tx) => {
      await lockShop(tx, actor.shopId);
      const repo = section ? sectionRepo : collectionRepo;
      const row = section ? await sectionRepo.find(actor.shopId, id, tx) : await collectionRepo.find(actor.shopId, id, tx);
      if (!row) throw notFound(section ? "Section" : "Collection");
      if (input.name !== undefined) await repo.update(actor.shopId, id, { name: input.name }, tx);
      if (input.position !== undefined) {
        const parentId = "categoryId" in row ? row.categoryId : row.collectionId;
        const siblings = await repo.list(actor.shopId, parentId, tx);
        const ordered = moveTo(siblings.map((s) => s.id), id, input.position);
        for (const [position, siblingId] of ordered.entries()) await repo.update(actor.shopId, siblingId, { position }, tx);
      }
      return section ? sectionRepo.find(actor.shopId, id, tx) : collectionRepo.find(actor.shopId, id, tx);
    }));
  },
  delete(actor: Actor, id: string, section = false) {
    return transaction(async (tx) => {
      await lockShop(tx, actor.shopId);
      const repo = section ? sectionRepo : collectionRepo;
      if (!(await repo.delete(actor.shopId, id, tx)).count) throw notFound(section ? "Section" : "Collection");
    });
  },
};
