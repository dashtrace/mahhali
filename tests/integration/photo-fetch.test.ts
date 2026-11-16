import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isPublicAddress } from "@/server/domain/photoLinks";
import { fetchPhoto } from "@/server/storage/fetchPhoto";
import { JPG, PNG, startPhotoServer, type PhotoServer } from "./photoServer";

let server: PhotoServer;

beforeAll(async () => {
  server = await startPhotoServer();
});
afterAll(() => server.close());

const fetch = (p: string) => fetchPhoto(server.url(p), server.deps);

describe("downloading a photo from a link", () => {
  it("downloads PNG and JPEG photos", async () => {
    expect(await fetch("/good.png")).toEqual({ ok: true, bytes: PNG });
    expect(await fetch("/good.jpg")).toEqual({ ok: true, bytes: JPG });
  });

  it("follows a redirect to a photo", async () => {
    expect(await fetch("/to-good")).toEqual({ ok: true, bytes: PNG });
  });

  it("checks the certificate against the host in the link", async () => {
    // drive.google.com pointed at the test server: its certificate isn't for that name, so nothing downloads.
    const r = await fetchPhoto("https://drive.google.com/file/d/abc/view", {
      ...server.deps,
      resolve: async () => ["127.0.0.1"],
    });
    expect(r).toEqual({ ok: false, problem: "The link couldn't be reached." });
  });

  it("refuses a page that is not an image", async () => {
    expect(await fetch("/page.html")).toEqual({ ok: false, problem: "The link is not a PNG, JPEG or WebP image." });
  });

  it("reports an error status", async () => {
    expect(await fetch("/missing.png")).toEqual({ ok: false, problem: "The link returned an error (HTTP 404)." });
  });

  it("stops at 3 MB, whether or not the size is declared", async () => {
    expect(await fetch("/big.jpg")).toEqual({ ok: false, problem: "The photo is larger than 3 MB." });
    expect(await fetch("/big-declared.jpg")).toEqual({ ok: false, problem: "The photo is larger than 3 MB." });
  });

  it("gives up on a slow server", async () => {
    expect(await fetch("/slow.png")).toEqual({ ok: false, problem: "The link took too long to answer." });
  });

  it("refuses a redirect to a private address", async () => {
    expect(await fetch("/to-private")).toEqual({ ok: false, problem: "This link points to a private address." });
  });

  it("refuses a redirect to plain http", async () => {
    expect(await fetch("/to-http")).toEqual({ ok: false, problem: "Only https:// links can be used." });
  });

  it("stops after three redirects", async () => {
    const before = server.hits();
    expect(await fetch("/loop")).toEqual({ ok: false, problem: "The link redirects too many times." });
    expect(server.hits() - before).toBe(4);
  });

  it("refuses a host that resolves to this machine, without connecting", async () => {
    const before = server.hits();
    const r = await fetchPhoto(server.url("/good.png"), { ...server.deps, isAllowed: isPublicAddress });
    expect(r).toEqual({ ok: false, problem: "This link points to a private address." });
    expect(server.hits()).toBe(before);
  });

  it("refuses a host with any private address among its answers", async () => {
    const r = await fetchPhoto("https://mixed.test/good.png", server.deps);
    expect(r).toEqual({ ok: false, problem: "This link points to a private address." });
  });

  it("refuses a host that does not resolve", async () => {
    const r = await fetchPhoto("https://nowhere.test/good.png", server.deps);
    expect(r).toEqual({ ok: false, problem: "This link points to a private address." });
  });

  it("checks the link itself before any network use", async () => {
    expect(await fetchPhoto("http://example.com/a.png", server.deps)).toEqual({ ok: false, problem: "Only https:// links can be used." });
  });
});
