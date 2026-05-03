import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login", "/forgot-password", "/reset-password", "/invite"];

function isPublicPath(pathname: string) {
  return publicRoutes.some((route) => pathname === route || pathname.startsWith(route));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("role")?.value;

  if (!accessToken && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (accessToken && (pathname === "/login" || pathname === "/")) {
    if (role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    if (role === "AGRONOMIST") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    if (role === "PRODUCER") {
      return NextResponse.redirect(new URL("/producer-only", request.url));
    }
  }

  if (role === "PRODUCER" && !pathname.startsWith("/producer-only")) {
    return NextResponse.redirect(new URL("/producer-only", request.url));
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (
    !pathname.startsWith("/admin") &&
    pathname !== "/producer-only" &&
    role === "ADMIN" &&
    !isPublicPath(pathname)
  ) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
