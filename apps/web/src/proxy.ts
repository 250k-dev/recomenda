import { NextRequest, NextResponse } from "next/server";
import { errors, jwtVerify } from "jose";
import { serverEnv } from "@recomenda/config/server";

const publicRoutes = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/convite",
  "/cotacao",
  "/exportar",
  "/privacidade",
  "/termos",
];

const protectedPrefixes = [
  "/dashboard",
  "/admin",
  "/produtores",
  "/fazendas",
  "/safras",
  "/produtos",
  "/equipe",
  "/relatorios",
  "/cronograma",
  "/perfil",
  "/templates-de-compra",
  "/minhas-gestoes",
  "/acesso-produtor",
];

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return matchesPrefix(pathname, publicRoutes);
}

function isProtectedPath(pathname: string) {
  return matchesPrefix(pathname, protectedPrefixes);
}

/**
 * Estado do access token. `expirado` é separado de `invalido` de propósito: os
 * dois falham em `jwtVerify`, mas exigem respostas opostas — ver o comentário
 * do ramo de expulsão em `proxy()`.
 */
type EstadoSessao =
  | { estado: "sem-token" }
  | { estado: "sem-segredo" }
  | { estado: "valido"; role: string | null }
  | { estado: "expirado" }
  | { estado: "invalido" };

async function lerAccessToken(accessToken: string | undefined): Promise<EstadoSessao> {
  if (!accessToken) return { estado: "sem-token" };

  const secret = serverEnv.JWT_SECRET;
  if (!secret) {
    return { estado: "sem-segredo" };
  }

  try {
    const { payload } = await jwtVerify(
      accessToken,
      new TextEncoder().encode(secret),
    );
    return {
      estado: "valido",
      role: typeof payload.role === "string" ? payload.role : null,
    };
  } catch (erro) {
    // Assinatura confere, só venceu o `exp`.
    if (erro instanceof errors.JWTExpired) return { estado: "expirado" };
    // Assinatura quebrada, token malformado ou claim inválida.
    return { estado: "invalido" };
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
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const cookieRole = request.cookies.get("role")?.value;
  const sessao = await lerAccessToken(accessToken);
  const verifiedRole = sessao.estado === "valido" ? sessao.role : null;
  const role = verifiedRole ?? cookieRole ?? null;
  const forceLogin =
    request.nextUrl.searchParams.get("force") === "1" ||
    request.nextUrl.searchParams.get("force") === "true";

  if (isPublicPath(pathname)) {
    const sessaoAtiva =
      sessao.estado === "valido" || (sessao.estado === "expirado" && Boolean(refreshToken));
    if (sessaoAtiva && role && (pathname === "/login" || pathname === "/") && !forceLogin) {
      const redirectTo = role === "ADMIN" || role === "ORG_ADMIN" ? "/admin" : "/dashboard";
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    return NextResponse.next();
  }

  // URL fora da árvore autenticada: deixa o App Router renderizar `not-found`.
  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL("/login?force=1", request.url));
  }

  // Sessão forjada — assinatura quebrada, token malformado ou claim inválida.
  // Não há o que renovar: derruba tudo.
  //
  // Token só EXPIRADO não entra aqui, e a distinção é load-bearing. O access
  // vive 1h e o refresh 30 dias, mas quem renova é o interceptor de 401 do
  // axios (`packages/api/src/http/axios.ts:70`), que só roda depois da página
  // carregar — o proxy roda antes, em navegação. Se ele apagasse o
  // refresh_token aqui, toda navegação feita após 1h de sessão viraria
  // re-login, derrubando a sessão efetiva de 30 dias para 1 hora.
  // Com refresh_token no cookie, deixa passar e o XHR renova.
  const sessaoForjada = sessao.estado === "invalido";
  const expiradoSemRenovacao = sessao.estado === "expirado" && !refreshToken;

  if (sessaoForjada || expiradoSemRenovacao) {
    const response = NextResponse.redirect(new URL("/login?force=1", request.url));
    response.cookies.delete("access_token");
    response.cookies.delete("refresh_token");
    response.cookies.delete("role");
    return response;
  }

  if (
    (role === "AGRONOMIST" || role === "STAFF" || role === "PRODUCER") &&
    pathname.startsWith("/admin")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if ((role === "ADMIN" || role === "ORG_ADMIN") && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
