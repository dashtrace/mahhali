const SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
const RESERVED = new Set(["admin", "api", "app", "login", "signup", "settings", "t", "s", "track"]);

export function isValidSlug(slug: string): boolean {
  return SLUG.test(slug) && !slug.includes("--") && !RESERVED.has(slug);
}
