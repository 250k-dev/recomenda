import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { clearAuthCookies, setAuthCookies } from "@/lib/auth/session-cookies";

type LoginPayload = {
  access_token: string;
  refresh_token: string;
  user: { role: string; [key: string]: unknown };
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await fetch(`${env.API_INTERNAL_URL}/auth/login`, {
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

  if (payload.user.role === "PRODUCER") {
    clearAuthCookies(cookieStore);
    return NextResponse.json(
      {
        error: {
          code: "PRODUCER_WEB_FORBIDDEN",
          message:
            "Produtores não têm acesso ao painel web. Entre em contato com o suporte.",
        },
      },
      { status: 403 },
    );
  }

  setAuthCookies(cookieStore, {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    role: payload.user.role,
  });

  return NextResponse.json({ user: payload.user });
}
