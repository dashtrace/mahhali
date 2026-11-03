/**
 * A variant's values after its product's options change. `from[i]` is the old position of the
 * option now at i, or null for a new option (blank values). Options left out lose their values.
 */
export function remapValues(values: string[], from: (number | null)[]) {
  return from.map((i) => (i === null ? "" : (values[i] ?? "")));
}
