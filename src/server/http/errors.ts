// Errors that services and the route wrapper turn into one JSON shape:
// { error: { code, message, details } }
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "VALIDATION_FAILED", message, details);
export const unauthorized = () => new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
export const forbidden = (message = "Your role does not allow this.") =>
  new AppError(403, "FORBIDDEN", message);
// Anything in another shop is "not found", so ids from other shops reveal nothing.
export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found.`);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
export const tooManyRequests = (retryAfter: number) =>
  new AppError(429, "RATE_LIMITED", "Too many attempts. Try again in a moment.", { retryAfter });
