/**
 * Tokens ficam em cookies httpOnly gerenciados pelo BFF `/api/auth/*`.
 * Este módulo mantém helpers no-op para não quebrar imports legados.
 */

export function setAccessToken(_token: string | null) {
  /* cookies httpOnly — sem storage no browser */
}

export function getAccessToken(): string | null {
  return null;
}

export function setUserRole(_role: string | null) {
  /* role vem do cookie /auth/me */
}

export function getUserRole(): string | null {
  return null;
}

export function clearAccessToken() {
  /* use POST /api/auth/logout */
}
