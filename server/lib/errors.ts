export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INTERNAL"

/** The `{ error }` envelope that src/lib/api.ts reads. */
export const errorBody = (
  code: ErrorCode,
  message: string,
  details?: unknown
) => ({ error: { code, message, details } })
