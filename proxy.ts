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

  if (isPublicPath(pathname)) {
    const accessToken = request.cookies.get("access_token")?.value;
    if (accessToken && (pathname === "/login" || pathname === "/")) {
      const role = request.cookies.get("role")?.value;
      const redirectTo = role === "ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token")?.value;
  const role = request.cookies.get("role")?.value;

  if (!accessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role === "PRODUCER") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (role === "AGRONOMIST" && pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
