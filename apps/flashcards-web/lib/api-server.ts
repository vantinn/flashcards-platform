// Importing next/headers already restricts this module to Server Components
// / Server Functions / Route Handlers — it throws if pulled into client code.
import { cookies } from "next/headers";
import { api } from "./api-client";

async function cookieHeader(): Promise<string> {
  const store = await cookies();
  return store.toString();
}

/**
 * Same API surface as `api` from lib/api-client.ts, but forwards the
 * incoming request's auth cookies — Next.js does not do this automatically
 * for server-to-server fetch calls, unlike the browser's own cookie jar.
 */
export const serverApi = {
  get: async <T>(path: string) => api.get<T>(path, { cookieHeader: await cookieHeader() }),
  post: async <T>(path: string, body?: unknown) => api.post<T>(path, body, { cookieHeader: await cookieHeader() }),
  patch: async <T>(path: string, body?: unknown) => api.patch<T>(path, body, { cookieHeader: await cookieHeader() }),
  delete: async <T>(path: string) => api.delete<T>(path, { cookieHeader: await cookieHeader() }),
};

export { ApiError } from "./api-client";
