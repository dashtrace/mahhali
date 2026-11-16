import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isPublicAddress, parsePhotoLink } from "../domain/photoLinks";
import { sniffType } from "./uploads";

// Downloads a product photo from a link someone gave an AI assistant. The link
// is untrusted, so: HTTPS only, the host is looked up once and the connection
// goes to the address that was checked (no DNS rebinding), every redirect is
// checked again, and the download stops at 10 s or 3 MB.

export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 3;

export type FetchedPhoto = { ok: true; bytes: Uint8Array } | { ok: false; problem: string };

/** What tests swap out; production uses real DNS, port 443 and the public CA list. */
export type PhotoFetchDeps = {
  resolve: (host: string) => Promise<string[]>;
  isAllowed: (ip: string) => boolean;
  port: number;
  ca?: string;
  timeoutMs: number;
};

/** Production settings; integration tests point them at a local server. */
export const photoFetchConfig: PhotoFetchDeps = {
  resolve: async (host) => (await dnsLookup(host, { all: true })).map((a) => a.address),
  isAllowed: isPublicAddress,
  port: 443,
  timeoutMs: 10_000,
};

class Refused extends Error {}

export async function fetchPhoto(link: string, overrides: Partial<PhotoFetchDeps> = {}): Promise<FetchedPhoto> {
  const deps = { ...photoFetchConfig, ...overrides };
  const signal = AbortSignal.timeout(deps.timeoutMs);
  let current = link;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = parsePhotoLink(current);
      if (!parsed.ok) return parsed;
      const res = await get(parsed.url, deps, signal);
      if (res.kind === "redirect") {
        current = new URL(res.location, parsed.url).toString();
        continue;
      }
      return res.photo;
    }
    return { ok: false, problem: "The link redirects too many times." };
  } catch (err) {
    if (err instanceof Refused) return { ok: false, problem: err.message };
    if (signal.aborted) return { ok: false, problem: "The link took too long to answer." };
    return { ok: false, problem: "The link couldn't be reached." };
  }
}

type Hop = { kind: "redirect"; location: string } | { kind: "done"; photo: FetchedPhoto };

function get(url: URL, deps: PhotoFetchDeps, signal: AbortSignal): Promise<Hop> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: "https:",
        host: url.hostname.replace(/^\[|\]$/g, ""),
        servername: url.hostname.startsWith("[") ? undefined : url.hostname,
        port: deps.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { "user-agent": "MahhaliPhotoFetcher/1.0", accept: "image/png,image/jpeg,image/webp" },
        lookup: checkedLookup(deps),
        ca: deps.ca,
        signal,
        agent: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(status)) {
          res.resume();
          const location = res.headers.location;
          if (!location) return resolve(done("The link redirects nowhere."));
          return resolve({ kind: "redirect", location });
        }
        if (status < 200 || status > 299) {
          res.resume();
          return resolve(done(`The link returned an error (HTTP ${status}).`));
        }
        if (Number(res.headers["content-length"] ?? 0) > PHOTO_MAX_BYTES) {
          res.destroy();
          return resolve(done("The photo is larger than 3 MB."));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > PHOTO_MAX_BYTES) {
            res.destroy();
            resolve(done("The photo is larger than 3 MB."));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const bytes = new Uint8Array(Buffer.concat(chunks));
          const type = sniffType(bytes);
          if (type !== "png" && type !== "jpg" && type !== "webp") {
            return resolve(done("The link is not a PNG, JPEG or WebP image."));
          }
          resolve({ kind: "done", photo: { ok: true, bytes } });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function done(problem: string): Hop {
  return { kind: "done", photo: { ok: false, problem } };
}

/** DNS lookup that only ever hands the socket an address that passed the check. */
function checkedLookup(deps: PhotoFetchDeps): LookupFunction {
  return (hostname, options, callback) => {
    deps
      .resolve(hostname)
      .then((addresses) => {
        const allowed = addresses.filter(deps.isAllowed);
        if (allowed.length === 0 || allowed.length !== addresses.length) {
          throw new Refused("This link points to a private address.");
        }
        const family = allowed[0].includes(":") ? 6 : 4;
        if (options.all) callback(null, [{ address: allowed[0], family }]);
        else callback(null, allowed[0], family);
      })
      .catch((err: Error) => callback(err as NodeJS.ErrnoException, "", 4));
  };
}
