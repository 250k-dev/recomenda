import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { clearAuthCookies } from "@/lib/auth/session-cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (refreshToken) {
    await fetch(`${env.API_INTERNAL_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch(() => null);
  }

  clearAuthCookies(cookieStore);
  return NextResponse.json({ success: true });
}
