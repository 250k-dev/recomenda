type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
};

type CookieStore = {
  set: (name: string, value: string, options?: CookieOptions) => void;
  delete: (name: string) => void;
};

const isProd = process.env.NODE_ENV === "production";

const baseOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

export function setAuthCookies(
  cookieStore: CookieStore,
  tokens: { access_token: string; refresh_token: string; role: string },
) {
  cookieStore.set("refresh_token", tokens.refresh_token, {
    ...baseOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.set("access_token", tokens.access_token, {
    ...baseOptions,
    maxAge: 60 * 60,
  });
  cookieStore.set("role", tokens.role, {
    ...baseOptions,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(cookieStore: CookieStore) {
  cookieStore.delete("refresh_token");
  cookieStore.delete("access_token");
  cookieStore.delete("role");
}

export function setAccessCookie(cookieStore: CookieStore, accessToken: string, role?: string) {
  cookieStore.set("access_token", accessToken, {
    ...baseOptions,
    maxAge: 60 * 60,
  });
  if (role) {
    cookieStore.set("role", role, {
      ...baseOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}
