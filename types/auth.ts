export type UserRole = "ADMIN" | "AGRONOMIST" | "PRODUCER";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}
