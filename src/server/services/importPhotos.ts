import { MAX_PHOTO_DOWNLOADS, PHOTOS_PER_PRODUCT, matchColour } from "../domain/photoLinks";
import type { ImportPhoto, StoredProduct } from "../domain/productImport";
import { fetchPhoto } from "../storage/fetchPhoto";
import { deleteUpload, saveUpload } from "../storage/uploads";

// Photo links in a product import, downloaded at preview time so the user
// sees which links failed before confirming. Files of previews that are never
// confirmed are deleted with the preview.

export type PhotoRequest = { url: string; colour?: string | null };
export type PhotoProblem = { url: string; problem: string };

const PARALLEL_DOWNLOADS = 8;

type Job = { product: number; order: number; url: string; optionValue: string | null };

/**
 * Downloads the photos of each product (5 per product, 50 per call) and saves
 * them for the shop. A failed link becomes a problem on its product; the
 * product itself can still be imported.
 */
export async function downloadImportPhotos(
  shopId: string,
  products: { requests: PhotoRequest[]; optionValues: string[] }[],
): Promise<{ photos: ImportPhoto[][]; problems: PhotoProblem[][] }> {
  const photos: ImportPhoto[][] = products.map(() => []);
  const problems: PhotoProblem[][] = products.map(() => []);
  const jobs: Job[] = [];
  let budget = MAX_PHOTO_DOWNLOADS;

  products.forEach(({ requests, optionValues }, product) => {
    requests.forEach((r, order) => {
      if (order >= PHOTOS_PER_PRODUCT) {
        problems[product].push({ url: r.url, problem: `A product can have up to ${PHOTOS_PER_PRODUCT} photos; this one was left out.` });
        return;
      }
      let optionValue: string | null = null;
      if (r.colour?.trim()) {
        optionValue = matchColour(r.colour, optionValues);
        if (!optionValue) {
          problems[product].push({ url: r.url, problem: `"${r.colour}" is not one of this product's option values; the photo will show for every variant.` });
        }
      }
      if (budget === 0) {
        problems[product].push({ url: r.url, problem: `Up to ${MAX_PHOTO_DOWNLOADS} photos per preview; add the rest in a later import or on the upload page.` });
        return;
      }
      budget--;
      jobs.push({ product, order, url: r.url, optionValue });
    });
  });

  const saved: (ImportPhoto & Job)[] = [];
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const result = await fetchPhoto(job.url);
      if (!result.ok) {
        problems[job.product].push({ url: job.url, problem: result.problem });
        continue;
      }
      const url = await saveUpload(shopId, new File([result.bytes.slice()], "photo"), "photo");
      saved.push({ ...job, url });
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, jobs.length) }, worker));

  // Keep the order the user gave, whichever download finished first.
  saved.sort((a, b) => a.order - b.order);
  for (const s of saved) photos[s.product].push({ url: s.url, optionValue: s.optionValue });
  return { photos, problems };
}

/** Removes the downloaded files of previews nobody will confirm. */
export async function deleteImportPhotos(shopId: string, products: StoredProduct[]): Promise<void> {
  await Promise.all(products.flatMap((p) => (p.photos ?? []).map((photo) => deleteUpload(shopId, photo.url))));
}
