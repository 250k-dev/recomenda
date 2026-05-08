const TOKEN_KEY = "access_token";
const ROLE_KEY = "user_role";

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setUserRole(role: string | null) {
  if (typeof window === "undefined") return;
  if (role) {
    localStorage.setItem(ROLE_KEY, role);
  } else {
    localStorage.removeItem(ROLE_KEY);
  }
}

export function getUserRole() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROLE_KEY);
}

export function clearAccessToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}
