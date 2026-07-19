import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@recomenda/config/server";

export const runtime = "nodejs";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
  "content-length",
  // fetch() já descomprime o body; repassar esses headers causa ERR_CONTENT_DECODING_FAILED
  "content-encoding",
  "accept-encoding",
]);

async function proxyToNest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const target = new URL(`${serverEnv.API_INTERNAL_URL}/${path}`);
  target.search = request.nextUrl.search;

  const cookieStore = await cookies();
  const accessToken = cookieStore.get("access_token")?.value;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // Evita gzip/br do Nest: o undici descomprime e o browser quebraria no Content-Encoding.
  headers.set("Accept-Encoding", "identity");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    headers.delete("Authorization");
  }

  const method = request.method.toUpperCase();
  const hasBody = !["GET", "HEAD"].includes(method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(target, {
    method,
    headers,
    body,
    redirect: "manual",
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === "set-cookie") {
      return;
    }
    responseHeaders.set(key, value);
  });
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  try {
    return await proxyToNest(request, path);
  } catch {
    return NextResponse.json(
      { error: { code: "PROXY_ERROR", message: "Falha ao contatar a API" } },
      { status: 502 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
