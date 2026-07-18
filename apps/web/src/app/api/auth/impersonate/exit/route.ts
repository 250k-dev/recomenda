import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";
import { setAccessCookie } from "@/lib/auth/session-cookies";

function jwtPayloadRole(accessToken: string): string | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const payload = JSON.parse(atob(base64)) as { role?: unknown };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const response = await fetch(`${serverEnv.API_INTERNAL_URL}/auth/impersonate/exit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Exit failed" }));
    return NextResponse.json(err, { status: response.status });
  }

  const payload = (await response.json()) as { access_token: string };
  const role = jwtPayloadRole(payload.access_token) ?? "AGRONOMIST";
  setAccessCookie(cookieStore, payload.access_token, role);
  return NextResponse.json({ ok: true, role });
}
