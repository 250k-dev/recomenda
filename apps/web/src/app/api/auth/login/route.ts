import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";
import { setAuthCookies } from "@/lib/auth/session-cookies";

type LoginPayload = {
  access_token: string;
  refresh_token: string;
  user: { role: string; [key: string]: unknown };
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ message: "Invalid credentials" }));
    return NextResponse.json(err, { status: response.status });
  }

  const payload = (await response.json()) as LoginPayload;
  const cookieStore = await cookies();

  setAuthCookies(cookieStore, {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    role: payload.user.role,
  });

  return NextResponse.json({ user: payload.user });
}
