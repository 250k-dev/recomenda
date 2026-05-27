import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("refresh_token");
  cookieStore.delete("access_token");
  cookieStore.delete("role");

  return NextResponse.json({ success: true });
}
