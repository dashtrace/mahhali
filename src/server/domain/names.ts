// What customers' names look like on public pages: never the full name.

/** "Maya Haddad" -> "Maya". */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** "Maya Al Haddad" -> "Maya H."; a single name stays as it is. */
export function reviewAuthorName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : "";
  return last ? `${parts[0]} ${Array.from(last)[0].toUpperCase()}.` : parts[0];
}
