import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";
import { clearAuthCookies } from "@/lib/auth/session-cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    await fetch(`${serverEnv.API_INTERNAL_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => null);
  }

  clearAuthCookies(cookieStore);
  return NextResponse.json({ success: true });
}
