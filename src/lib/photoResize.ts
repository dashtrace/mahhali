// Making a phone photo small enough to upload (3 MB, PNG/JPEG/WebP) before it
// leaves the browser. The size maths is pure so it can be unit tested; the
// canvas work is in shrinkPhoto.

export const UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
/** Longest side kept: plenty for a product page, and a fraction of a 12 MP photo's bytes. */
export const MAX_SIDE = 2000;
/** JPEG qualities tried in turn until the photo fits. */
export const QUALITY_STEPS = [0.85, 0.72, 0.6, 0.45];
const SENDABLE = ["image/png", "image/jpeg", "image/webp"];

/** The size to draw at: the longest side at most `maxSide`, proportions kept, never enlarged. */
export function scaledSize(width: number, height: number, maxSide = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const ratio = maxSide / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

/** A file that can go up exactly as it is. */
export function canSendAsIs(file: { type: string; size: number }, width: number, height: number): boolean {
  return SENDABLE.includes(file.type) && file.size <= UPLOAD_MAX_BYTES && Math.max(width, height) <= MAX_SIDE;
}

/** Resizes and re-encodes as JPEG when needed; null when the browser can't read the photo or it can't be made small enough. */
export async function shrinkPhoto(file: File): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  try {
    if (canSendAsIs(file, bitmap.width, bitmap.height)) return file;
    const { width, height } = scaledSize(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // White behind transparent PNGs, which JPEG can't keep.
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    for (const quality of QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= UPLOAD_MAX_BYTES) return blob;
    }
    return null;
  } finally {
    bitmap.close();
  }
}
