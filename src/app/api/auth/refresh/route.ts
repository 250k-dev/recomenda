import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/config/env";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: "No refresh token" }, { status: 401 });
  }

  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    return NextResponse.json({ message: "Refresh failed" }, { status: 401 });
  }

  const payload = await response.json();
  cookieStore.set("access_token", payload.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  return NextResponse.json(payload);
}
