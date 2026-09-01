import { ApiError } from "./api-client";

/**
 * Maps a caught error to safe, user-facing copy. ApiError already carries
 * the backend's own message, and HttpExceptionFilter (server-side) is the
 * actual safety boundary — it never lets a stack trace or internal detail
 * through the message field for *any* status code, whether that's a
 * deliberately-thrown 4xx/503 (crafted to already be safe and specific,
 * e.g. "Please wait 45s before requesting another code.", or "Email
 * delivery is not available right now.") or a truly unexpected 500 (which
 * the filter reduces to a fixed "Internal server error" itself). So this
 * only needs its own fallback for a blank message, plus the one case the
 * server can't cover: a request that never reached it at all.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || "Something went wrong. Please try again.";
  }
  return "Unable to connect to the server. Please try again.";
}
