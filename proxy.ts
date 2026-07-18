import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const publicRoutes = ["/login", "/esqueci-senha", "/redefinir-senha", "/convite", "/cotacao", "/acesso-produtor"];

function isPublicPath(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

async function readAccessRole(accessToken: string | undefined): Promise<string | null> {
  if (!accessToken) return null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(secret),
    );
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // BFF auth e proxy API: não interferir (route handlers cuidam).
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const cookieRole = request.cookies.get("role")?.value;
  const verifiedRole = await readAccessRole(accessToken);
  const role = verifiedRole ?? cookieRole ?? null;
  const forceLogin =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  if (isPublicPath(pathname)) {
    if (
      accessToken &&
      role &&
      role !== "PRODUCER" &&
      (pathname === "/login" || pathname === "/") &&
      !forceLogin
    ) {
      const redirectTo = role === "ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    return NextResponse.next();
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL("/login?force=1", request.url));
  }

  // Token presente mas inválido (exp/sig) quando JWT_SECRET está configurado.
  if (process.env.JWT_SECRET && !verifiedRole) {
    const response = NextResponse.redirect(new URL("/login?force=1", request.url));
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("role");
    return response;
  }

  if (role === "PRODUCER") {
    return NextResponse.redirect(new URL("/acesso-produtor", request.url));
  }

  if ((role === "AGRONOMIST" || role === "STAFF") && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (role === "ADMIN" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
