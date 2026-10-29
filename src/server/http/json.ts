// Prisma returns money columns as bigint, which JSON.stringify cannot handle.
// Amounts stay far below 2^53, so they are sent as plain numbers.
function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  return value;
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = new Headers(headers);
  h.set("content-type", "application/json");
  return new Response(JSON.stringify(data, replacer), { status, headers: h });
}
