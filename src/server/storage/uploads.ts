import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "../domain/tokens";
import { badRequest, notFound, unprocessable } from "../http/errors";

// Logos and product photos on local disk (a Docker volume in production, where
// Caddy serves /uploads directly). Files are named by a random token, so a URL
// reveals nothing and is never reused.
const TYPES = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" } as const;
type Ext = keyof typeof TYPES;

const KINDS = {
  photo: { maxBytes: 3 * 1024 * 1024, types: ["png", "jpg", "webp"] as Ext[] },
  // SVG is safe here because pages show it with <img> and the file is served
  // with a sandbox CSP, so its scripts never run.
  logo: { maxBytes: 1024 * 1024, types: ["png", "jpg", "webp", "svg"] as Ext[] },
};
export type UploadKind = keyof typeof KINDS;

const FILE_NAME = /^[A-Za-z0-9_-]+\.(png|jpg|webp|svg)$/;
const SHOP_DIR = /^[A-Za-z0-9_-]+$/;

/** Headers for every served upload: no type sniffing, and no script even in an SVG. */
export const UPLOAD_HEADERS = {
  "x-content-type-options": "nosniff",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
};

function uploadDir() {
  return process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads");
}

/** The real type from the first bytes; the file name and claimed type are ignored. */
export function sniffType(bytes: Uint8Array): Ext | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  const head = new TextDecoder().decode(bytes.subarray(0, 1024));
  if (/^﻿?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return null;
}

/** The multipart form of an upload request; 400 when the body is not one. */
export async function readForm(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw badRequest("Send the file as multipart/form-data.");
  }
}

/** Checks and stores an uploaded file; returns its public URL. */
export async function saveUpload(shopId: string, file: FormDataEntryValue | null, kind: UploadKind): Promise<string> {
  if (!(file instanceof Blob)) throw badRequest("Attach the image as the `file` field.");
  const { maxBytes, types } = KINDS[kind];
  if (file.size > maxBytes) {
    throw unprocessable("FILE_TOO_LARGE", `The file must be under ${maxBytes / 1024 / 1024} MB.`, { maxBytes });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniffType(bytes);
  if (!ext || !types.includes(ext)) {
    throw unprocessable("UNSUPPORTED_FILE", `Upload a ${types.map((t) => t.toUpperCase()).join(", ")} image.`);
  }
  const name = `${randomToken(16)}.${ext}`;
  await mkdir(path.join(uploadDir(), shopId), { recursive: true });
  await writeFile(path.join(uploadDir(), shopId, name), bytes);
  return `/uploads/${shopId}/${name}`;
}

/** Removes a file saveUpload stored for this shop; anything else is left alone. */
export async function deleteUpload(shopId: string, url: string | null): Promise<void> {
  const [, root, dir, name] = url?.split("/") ?? [];
  if (root !== "uploads" || dir !== shopId || !FILE_NAME.test(name ?? "")) return;
  await unlink(path.join(uploadDir(), shopId, name)).catch(() => undefined);
}

/** A stored file by its URL segments [shopId, file]; 404 for anything else. */
export async function readUpload(segments: string[]): Promise<{ bytes: Buffer; contentType: string }> {
  const [dir, name] = segments;
  // The two patterns allow no dots in folders and no slashes, so no path can leave the upload directory.
  if (segments.length !== 2 || !SHOP_DIR.test(dir) || !FILE_NAME.test(name)) throw notFound("File");
  try {
    const bytes = await readFile(path.join(uploadDir(), dir, name));
    return { bytes, contentType: TYPES[name.split(".")[1] as Ext] };
  } catch {
    throw notFound("File");
  }
}
