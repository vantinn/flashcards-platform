const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const isBrowser = typeof window !== "undefined";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  data: T;
}

interface ErrorBody {
  message?: string | string[];
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set by lib/api-server.ts to forward the incoming request's cookies on server-side calls. */
  cookieHeader?: string;
  /** Internal — prevents a second refresh-and-retry loop. */
  _isRetry?: boolean;
}

// Dedupes concurrent 401s in the browser into a single refresh call instead
// of each failed request racing its own — the access token is short-lived
// (15m) so this fires often once a session runs past that.
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { cookieHeader, headers, body, _isRetry, ...rest } = options;

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    // Cross-origin (different port) but same-site in dev/prod, so the
    // SameSite=Lax auth cookies still flow as long as credentials are
    // explicitly requested — the browser does not include them by default
    // on cross-origin fetches.
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    // Expired-access-token recovery: only in the browser (server-side
    // requests forward whatever cookies the incoming page request had —
    // there's no response to attach a refreshed Set-Cookie to mid-render),
    // only once per request, and never for the auth endpoints themselves.
    if (
      response.status === 401 &&
      isBrowser &&
      !_isRetry &&
      !path.startsWith("/auth/")
    ) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request<T>(path, { ...options, _isRetry: true });
      }
    }

    const errorBody: ErrorBody | null = await response.json().catch(() => null);
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message.join(", ")
      : (errorBody?.message ?? response.statusText);
    throw new ApiError(response.status, message);
  }

  const envelope: Envelope<T> = await response.json();
  return envelope.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
