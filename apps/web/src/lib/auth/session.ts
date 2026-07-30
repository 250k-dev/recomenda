import { cookies } from "next/headers";
import type { UserRole } from "@recomenda/api/auth-types";

export async function getSessionRole(): Promise<UserRole | null> {
  const cookieStore = await cookies();
  const role = cookieStore.get("role")?.value;
  if (
    role === "ADMIN" ||
    role === "ORG_ADMIN" ||
    role === "AGRONOMIST" ||
    role === "PRODUCER" ||
    role === "STAFF"
  ) {
    return role;
  }
  return null;
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get("access_token")?.value);
}
