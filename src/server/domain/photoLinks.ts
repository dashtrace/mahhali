// Product photos given as links (a CSV `images` column or links typed in the
// chat): which links may be downloaded, how share links become direct
// downloads, and which addresses the server must never connect to.
// Nothing here touches the network.
import { normalizeSearch } from "./arabic";

/** Photos a product may get through links and the upload page, together. */
export const PHOTOS_PER_PRODUCT = 5;
/** Links downloaded in one preview call, across all products. */
export const MAX_PHOTO_DOWNLOADS = 50;
const MAX_URL_LENGTH = 2048;

export type PhotoLink = { ok: true; url: URL } | { ok: false; problem: string };

const INSTAGRAM = /(^|\.)(instagram\.com|instagr\.am)$/;
const INTERNAL_HOST = /(^localhost$)|\.(localhost|local|internal|home|lan|corp)$/;

/**
 * Checks a photo link and returns the URL to download: HTTPS on the default
 * port, no user name or password, no private or internal host. Google Drive
 * and Dropbox share links are turned into direct downloads.
 */
export function parsePhotoLink(raw: string): PhotoLink {
  const text = raw.trim();
  if (text.length > MAX_URL_LENGTH) return fail("The link is too long.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return fail("This is not a link.");
  }
  if (url.protocol !== "https:") return fail("Only https:// links can be used.");
  if (url.port !== "") return fail("Links with a port number can't be used.");
  if (url.username || url.password) return fail("Links with a user name or password can't be used.");

  const host = url.hostname.toLowerCase();
  const ip = hostAsIp(host);
  if (ip !== null) {
    if (!isPublicAddress(ip)) return fail("This link points to a private address.");
  } else if (!host.includes(".") || INTERNAL_HOST.test(host)) {
    return fail("This link points to a private address.");
  }
  if (INSTAGRAM.test(host)) {
    return fail("Instagram links can't be downloaded. Save the photo and add it on the upload page instead.");
  }
  return { ok: true, url: directDownload(url) };
}

function fail(problem: string): PhotoLink {
  return { ok: false, problem };
}

/** Share pages of Google Drive and Dropbox, rewritten to the file itself. */
function directDownload(url: URL): URL {
  const host = url.hostname.toLowerCase();
  if (host === "drive.google.com") {
    const id = url.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
    if (id && /^[\w-]+$/.test(id)) return new URL(`https://drive.google.com/uc?export=download&id=${id}`);
  }
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    const direct = new URL(url);
    direct.searchParams.delete("dl");
    direct.searchParams.set("raw", "1");
    return direct;
  }
  return url;
}

/** The host as an IP address when it is one (URL has already canonicalised `127.1`, `0x7f.1`…). */
function hostAsIp(host: string): string | null {
  if (host.startsWith("[") && host.endsWith("]")) return host.slice(1, -1);
  return parseIPv4(host) ? host : null;
}

/** True only for addresses on the public internet; everything private, local or reserved is false. */
export function isPublicAddress(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4) return isPublicV4(v4);
  const v6 = parseIPv6(ip);
  if (!v6) return false;
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::a.b.c.d) carry an IPv4 address: judge that.
  const embedded = [v6[6] >> 8, v6[6] & 0xff, v6[7] >> 8, v6[7] & 0xff];
  if (v6.slice(0, 5).every((g) => g === 0) && v6[5] === 0xffff) return isPublicV4(embedded);
  if (v6[0] === 0x64 && v6[1] === 0xff9b && v6.slice(2, 6).every((g) => g === 0)) return isPublicV4(embedded);
  // Otherwise only global unicast (2000::/3), minus documentation, 6to4 and Teredo.
  if ((v6[0] & 0xe000) !== 0x2000) return false;
  if (v6[0] === 0x2001 && (v6[1] === 0x0db8 || v6[1] === 0)) return false;
  if (v6[0] === 0x2002) return false;
  return true;
}

const V4_BLOCKED: [number[], number][] = [
  [[0, 0, 0, 0], 8],
  [[10, 0, 0, 0], 8],
  [[100, 64, 0, 0], 10],
  [[127, 0, 0, 0], 8],
  [[169, 254, 0, 0], 16],
  [[172, 16, 0, 0], 12],
  [[192, 0, 0, 0], 24],
  [[192, 0, 2, 0], 24],
  [[192, 88, 99, 0], 24],
  [[192, 168, 0, 0], 16],
  [[198, 18, 0, 0], 15],
  [[198, 51, 100, 0], 24],
  [[203, 0, 113, 0], 24],
  [[224, 0, 0, 0], 4],
  [[240, 0, 0, 0], 4],
];

function isPublicV4(bytes: number[]): boolean {
  const n = toUint32(bytes);
  return !V4_BLOCKED.some(([net, bits]) => (n >>> (32 - bits)) === (toUint32(net) >>> (32 - bits)));
}

function toUint32(b: number[]): number {
  return ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
}

/** Dotted-quad IPv4 only (the canonical form that URL and DNS give). */
function parseIPv4(s: string): number[] | null {
  const parts = s.split(".");
  if (parts.length !== 4 || !parts.every((p) => /^(0|[1-9]\d{0,2})$/.test(p))) return null;
  const bytes = parts.map(Number);
  return bytes.every((b) => b <= 255) ? bytes : null;
}

/** IPv6 as eight 16-bit groups, with `::` and a trailing dotted IPv4 allowed. */
function parseIPv6(s: string): number[] | null {
  let text = s.toLowerCase().replace(/%.*$/, "");
  const tail = text.match(/:(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const v4 = parseIPv4(tail[1]);
    if (!v4) return null;
    text = `${text.slice(0, -tail[1].length)}${((v4[0] << 8) | v4[1]).toString(16)}:${((v4[2] << 8) | v4[3]).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const group = (h: string) => (h === "" ? [] : h.split(":"));
  const head = group(halves[0]);
  const rest = halves.length === 2 ? group(halves[1]) : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array(missing).fill("0"), ...rest];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

/**
 * The option value a photo is for ("Black", "أسود"), spelled as the product
 * has it; null when the product has no such value.
 */
export function matchColour(colour: string, optionValues: string[]): string | null {
  const wanted = normalizeSearch(colour);
  return optionValues.find((v) => normalizeSearch(v) === wanted) ?? null;
}

/** How many more photos a product may take, given how many it has. */
export function photosLeft(existing: number): number {
  return Math.max(0, PHOTOS_PER_PRODUCT - existing);
}
