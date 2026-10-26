// Browser-side calls to our own API. Every mutation in the UI goes through the
// same validated route handlers as any other client.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; headers?: Record<string, string> };

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && opts.body instanceof FormData;
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers: { ...(opts.body !== undefined && !isForm ? { "content-type": "application/json" } : {}), ...opts.headers },
    body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    credentials: "same-origin",
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? "HTTP_" + res.status, e?.message ?? "Something went wrong.", e?.details);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** A readable message for a failed call, including the first field error. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof ApiError) {
    const first = Array.isArray(error.details) ? (error.details[0] as { path?: string; message?: string }) : null;
    return first?.message ? `${error.message} ${first.path ? `(${first.path}) ` : ""}${first.message}` : error.message;
  }
  return fallback;
}

/** A fresh idempotency key, generated when a form loads. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
