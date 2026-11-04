/** Orders fetched at a time, per status, on the board and by Load more. */
export const PAGE_SIZE = 12;

type Row = { id: string; createdAt: string };

/** The list's sort order: newest first, then id. Same as orderRepo.list. */
const sortsAfter = (a: Row, b: Row) => a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.id < b.id);

/**
 * What a status shows after an auto-refresh: the fresh first page, then the pages already loaded.
 * A loaded order that sorts inside the fresh page but isn't in it has left this status, so it goes.
 * `fresh` holds every id in any status's fresh page, so a moved order never shows in two lists.
 */
export function mergeOrders<T extends Row>(page: T[], loaded: T[], fresh: ReadonlySet<string>): T[] {
  const last = page.at(-1);
  return last ? [...page, ...loaded.filter((o) => !fresh.has(o.id) && sortsAfter(o, last))] : [];
}

/** Adds a newly fetched page, skipping anything already listed. */
export function appendOrders<T extends Row>(list: T[], next: T[]): T[] {
  const have = new Set(list.map((o) => o.id));
  return [...list, ...next.filter((o) => !have.has(o.id))];
}
