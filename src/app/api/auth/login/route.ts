import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    return NextResponse.json({ message: "Invalid credentials" }, { status: response.status });
  }

  const payload = await response.json();
  const cookieStore = await cookies();

  cookieStore.set("refresh_token", payload.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  cookieStore.set("access_token", payload.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });

  cookieStore.set("role", payload.user.role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json(payload);
}
