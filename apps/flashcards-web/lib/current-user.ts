import { serverApi, ApiError } from "./api-server";
import type { PublicUser } from "@/types/flashcard";

/** Returns null instead of throwing when the caller is anonymous or the access token is stale. */
export async function getCurrentUser(): Promise<PublicUser | null> {
  try {
    return await serverApi.get<PublicUser>("/users/me");
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
