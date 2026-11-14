export type HeroTarget = { ctaCategoryId?: string | null; ctaCollectionId?: string | null; ctaSectionId?: string | null };
export type HeroCategory = { id: string; name: string; collections?: { id: string; name: string; sections: { id: string; name: string }[] }[] };

/** Resolve only within this shop; a removed target falls back to its closest surviving parent. */
export function validHeroTarget(target: HeroTarget, categories: HeroCategory[]) {
  const category = categories.find((c) => c.id === target.ctaCategoryId);
  const collection = category?.collections?.find((c) => c.id === target.ctaCollectionId);
  const section = collection?.sections.find((s) => s.id === target.ctaSectionId);
  return { ctaCategoryId: category?.id ?? null, ctaCollectionId: collection?.id ?? null, ctaSectionId: section?.id ?? null };
}

export function heroDestination(shopHref: string, target: HeroTarget, categories: HeroCategory[]) {
  const valid = validHeroTarget(target, categories);
  const qs = new URLSearchParams();
  if (valid.ctaCategoryId) qs.set("cat", valid.ctaCategoryId);
  if (valid.ctaCollectionId) qs.set("collection", valid.ctaCollectionId);
  if (valid.ctaSectionId) qs.set("section", valid.ctaSectionId);
  return qs.size ? `${shopHref}?${qs}` : shopHref;
}
