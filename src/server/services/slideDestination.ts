import type { Actor } from "../http/withRoute";
import { notFound, unprocessable } from "../http/errors";
import { categoryRepo } from "../repositories/storefrontRepo";
import { collectionRepo, sectionRepo } from "../repositories/collectionRepo";
import type { Db } from "../repositories/tx";

type Target = { ctaCategoryId?: string | null; ctaCollectionId?: string | null; ctaSectionId?: string | null };
/** A changed parent clears omitted children; explicit invalid combinations are refused. */
export async function slideDestination(actor: Actor, patch: Target, current: Target, tx: Db) {
  const ctaCategoryId = patch.ctaCategoryId === undefined ? current.ctaCategoryId ?? null : patch.ctaCategoryId;
  const categoryChanged = ctaCategoryId !== (current.ctaCategoryId ?? null);
  const ctaCollectionId = patch.ctaCollectionId === undefined ? (categoryChanged ? null : current.ctaCollectionId ?? null) : patch.ctaCollectionId;
  const collectionChanged = ctaCollectionId !== (current.ctaCollectionId ?? null);
  const ctaSectionId = patch.ctaSectionId === undefined ? (categoryChanged || collectionChanged ? null : current.ctaSectionId ?? null) : patch.ctaSectionId;
  if (ctaCategoryId && !(await categoryRepo.findById(actor.shopId, ctaCategoryId, tx))) throw notFound("Category");
  if (ctaCollectionId) {
    const c = await collectionRepo.find(actor.shopId, ctaCollectionId, tx);
    if (!c) throw notFound("Collection");
    if (c.categoryId !== ctaCategoryId) throw unprocessable("COLLECTION_CATEGORY_MISMATCH", "Choose a collection within the selected category.");
  }
  if (ctaSectionId) {
    const s = await sectionRepo.find(actor.shopId, ctaSectionId, tx);
    if (!s) throw notFound("Section");
    if (s.collectionId !== ctaCollectionId) throw unprocessable("SECTION_COLLECTION_MISMATCH", "Choose a section within the selected collection.");
  }
  return { ctaCategoryId, ctaCollectionId, ctaSectionId };
}
