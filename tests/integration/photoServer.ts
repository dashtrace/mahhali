import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { isPublicAddress } from "@/server/domain/photoLinks";
import type { PhotoFetchDeps } from "@/server/storage/fetchPhoto";

// A local HTTPS server standing in for the photo hosts people link to. Fake
// DNS maps the test host names; 127.0.0.1 is allowed only for this server.

export const PHOTO_HOST = "shop-photos.test";

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
export const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46]);

const DNS: Record<string, string[]> = {
  [PHOTO_HOST]: ["127.0.0.1"],
  "internal.test": ["10.0.0.1"],
  "mixed.test": ["127.0.0.1", "10.0.0.1"],
};

export type PhotoServer = { url: (p: string) => string; deps: Partial<PhotoFetchDeps>; hits: () => number; close: () => Promise<void> };

export async function startPhotoServer(): Promise<PhotoServer> {
  const dir = mkdtempSync(path.join(tmpdir(), "photo-cert-"));
  const key = path.join(dir, "key.pem");
  const cert = path.join(dir, "cert.pem");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-keyout", key, "-out", cert,
    "-subj", `/CN=${PHOTO_HOST}`, "-addext", `subjectAltName=DNS:${PHOTO_HOST},DNS:mixed.test`,
  ], { stdio: "ignore" });
  const ca = readFileSync(cert, "utf8");
  let hits = 0;

  const server = https.createServer({ key: readFileSync(key), cert: ca }, (req, res) => {
    hits++;
    const route = req.url ?? "/";
    if (route.startsWith("/good.png") || route.startsWith("/uc")) return void res.end(PNG);
    if (route.startsWith("/good.jpg")) return void res.end(JPG);
    if (route === "/page.html") return void res.end("<html><body>not a photo</body></html>");
    if (route === "/missing.png") return void res.writeHead(404).end();
    if (route === "/big.jpg") {
      res.write(JPG);
      res.end(Buffer.alloc(4 * 1024 * 1024));
      return;
    }
    if (route === "/big-declared.jpg") {
      res.writeHead(200, { "content-length": String(5 * 1024 * 1024) });
      return void res.end();
    }
    if (route === "/slow.png") return void setTimeout(() => res.end(PNG), 2_000);
    if (route === "/to-good") return void res.writeHead(302, { location: "/good.png" }).end();
    if (route === "/to-private") return void res.writeHead(302, { location: "https://internal.test/a.png" }).end();
    if (route === "/to-http") return void res.writeHead(302, { location: `http://${PHOTO_HOST}/good.png` }).end();
    if (route === "/loop") return void res.writeHead(302, { location: "/loop" }).end();
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;

  return {
    url: (p) => `https://${PHOTO_HOST}${p}`,
    deps: {
      port,
      ca,
      timeoutMs: 1_000,
      resolve: async (host) => DNS[host] ?? [],
      isAllowed: (ip) => ip === "127.0.0.1" || isPublicAddress(ip),
    },
    hits: () => hits,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
