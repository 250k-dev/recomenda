import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;
  const role = cookieStore.get("role")?.value ?? null;

  return NextResponse.json({
    authenticated: Boolean(accessToken),
    role,
  });
}
