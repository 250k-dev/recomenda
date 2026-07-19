import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";
import { setAccessCookie } from "@/lib/auth/session-cookies";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ producerId: string }> },
) {
  const { producerId } = await context.params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ message: "Unauthenticated" }, { status: 401 });
  }

  const response = await fetch(
    `${serverEnv.API_INTERNAL_URL}/auth/impersonate/${producerId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: "Impersonation failed" }));
    return NextResponse.json(err, { status: response.status });
  }

  const payload = (await response.json()) as { access_token: string };
  setAccessCookie(cookieStore, payload.access_token, "PRODUCER");
  return NextResponse.json({ ok: true });
}
