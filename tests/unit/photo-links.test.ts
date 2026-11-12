import { describe, expect, it } from "vitest";
import { isPublicAddress, matchColour, parsePhotoLink, photosLeft, PHOTOS_PER_PRODUCT } from "@/server/domain/photoLinks";

const url = (raw: string) => {
  const r = parsePhotoLink(raw);
  if (!r.ok) throw new Error(r.problem);
  return r.url.toString();
};
const problem = (raw: string) => {
  const r = parsePhotoLink(raw);
  return r.ok ? null : r.problem;
};

describe("photo links", () => {
  it("accepts ordinary https image links unchanged", () => {
    expect(url("  https://cdn.example.com/p/hoodie.jpg?w=800 ")).toBe("https://cdn.example.com/p/hoodie.jpg?w=800");
  });

  it("accepts https only", () => {
    expect(problem("http://cdn.example.com/a.jpg")).toContain("https://");
    expect(problem("ftp://cdn.example.com/a.jpg")).toContain("https://");
    expect(problem("file:///etc/passwd")).toContain("https://");
    expect(problem("javascript:alert(1)")).toContain("https://");
  });

  it("refuses things that are not links", () => {
    expect(problem("hoodie.jpg")).toBe("This is not a link.");
    expect(problem("")).toBe("This is not a link.");
    expect(problem(`https://a.com/${"x".repeat(2100)}`)).toContain("too long");
  });

  it("refuses ports and user names", () => {
    expect(problem("https://cdn.example.com:8443/a.jpg")).toContain("port");
    expect(url("https://cdn.example.com:443/a.jpg")).toBe("https://cdn.example.com/a.jpg");
    expect(problem("https://user:pass@cdn.example.com/a.jpg")).toContain("user name");
  });

  it("refuses private and internal hosts, however they are written", () => {
    for (const raw of [
      "https://127.0.0.1/a.jpg",
      "https://127.1/a.jpg",
      "https://0x7f.1/a.jpg",
      "https://2130706433/a.jpg",
      "https://0177.0.0.1/a.jpg",
      "https://10.0.0.5/a.jpg",
      "https://192.168.1.1/a.jpg",
      "https://169.254.169.254/latest/meta-data",
      "https://[::1]/a.jpg",
      "https://[::ffff:10.0.0.1]/a.jpg",
      "https://[::ffff:7f00:1]/a.jpg",
      "https://[fe80::1]/a.jpg",
      "https://[fd00::1]/a.jpg",
      "https://localhost/a.jpg",
      "https://app.localhost/a.jpg",
      "https://printer.local/a.jpg",
      "https://metadata.google.internal/a.jpg",
      "https://intranet/a.jpg",
    ]) {
      expect(problem(raw), raw).toBe("This link points to a private address.");
    }
  });

  it("allows public IP addresses", () => {
    expect(url("https://93.184.216.34/a.jpg")).toBe("https://93.184.216.34/a.jpg");
    expect(url("https://[2606:4700::1111]/a.jpg")).toBe("https://[2606:4700::1111]/a.jpg");
  });

  it("refuses Instagram links with a way forward", () => {
    expect(problem("https://www.instagram.com/p/C1abc/")).toContain("upload page");
    expect(problem("https://instagr.am/p/C1abc/")).toContain("upload page");
  });

  it("turns Google Drive share links into downloads", () => {
    const direct = "https://drive.google.com/uc?export=download&id=1AbC-d_9";
    expect(url("https://drive.google.com/file/d/1AbC-d_9/view?usp=sharing")).toBe(direct);
    expect(url("https://drive.google.com/open?id=1AbC-d_9")).toBe(direct);
    expect(url("https://drive.google.com/uc?id=1AbC-d_9&export=download")).toBe(direct);
  });

  it("turns Dropbox share links into downloads", () => {
    expect(url("https://www.dropbox.com/scl/fi/abc/hoodie.jpg?rlkey=xyz&dl=0")).toBe(
      "https://www.dropbox.com/scl/fi/abc/hoodie.jpg?rlkey=xyz&raw=1",
    );
  });
});

describe("public addresses", () => {
  it("refuses every private, local and reserved IPv4 range", () => {
    for (const ip of ["0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "172.31.255.255",
      "192.0.0.8", "192.0.2.1", "192.168.0.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });

  it("allows public IPv4 next to the private ranges", () => {
    for (const ip of ["8.8.8.8", "172.15.255.255", "172.32.0.1", "100.128.0.1", "93.184.216.34"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("judges IPv6 by its embedded IPv4 or its range", () => {
    for (const ip of ["::", "::1", "::ffff:10.0.0.1", "::ffff:127.0.0.1", "64:ff9b::a00:1", "fe80::1%eth0", "fc00::1",
      "ff02::1", "2001:db8::1", "2002:a00:1::1", "2001:0:4136::1", "::10.0.0.1"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ["2606:4700:4700::1111", "::ffff:8.8.8.8", "64:ff9b::808:808"]) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });

  it("refuses anything that is not an address", () => {
    for (const ip of ["", "example.com", "1.2.3", "256.1.1.1", "1:2:3", "1::2::3", "12345::"]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
});

describe("photo colours and limits", () => {
  it("matches a colour to the product's own spelling", () => {
    expect(matchColour("black", ["Black", "White"])).toBe("Black");
    expect(matchColour("أسود", ["اسود", "ابيض"])).toBe("اسود");
    expect(matchColour("Red", ["Black", "White"])).toBeNull();
  });

  it("allows five photos per product", () => {
    expect(PHOTOS_PER_PRODUCT).toBe(5);
    expect(photosLeft(0)).toBe(5);
    expect(photosLeft(4)).toBe(1);
    expect(photosLeft(5)).toBe(0);
    expect(photosLeft(7)).toBe(0);
  });
});
