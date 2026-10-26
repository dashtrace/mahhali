// Prisma returns money columns as bigint, which JSON.stringify cannot handle.
// Amounts stay far below 2^53, so they are sent as plain numbers.
function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  return value;
}

/**
 * The same plain shape the API returns (bigint -> number, Decimal and Date ->
 * string), for server components handing service results to client components.
 */
export function plain<T>(data: T): Jsonified<T> {
  return JSON.parse(JSON.stringify(data, replacer));
}

type Jsonified<T> = T extends bigint
  ? number
  : T extends Date
    ? string
    : T extends { toFixed: (d?: number) => string; toJSON: () => string }
      ? string
      : T extends (infer U)[]
        ? Jsonified<U>[]
        : T extends object
          ? { [K in keyof T]: Jsonified<T[K]> }
          : T;

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(data, replacer), { status, headers: h });
}
