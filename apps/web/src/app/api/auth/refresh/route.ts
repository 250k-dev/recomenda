import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session-cookies";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    clearAuthCookies(cookieStore);
    return NextResponse.json({ message: "No refresh token" }, { status: 401 });
  }

  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearAuthCookies(cookieStore);
    return NextResponse.json({ message: "Refresh failed" }, { status: 401 });
  }

  const payload = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  const role = cookieStore.get("role")?.value ?? "AGRONOMIST";
  setAuthCookies(cookieStore, {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? refreshToken,
    role,
  });

  return NextResponse.json({ ok: true });
}
