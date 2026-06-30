export type UserRole = "ADMIN" | "AGRONOMIST" | "PRODUCER" | "CONSULTANT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  impersonator?: Omit<AuthUser, "impersonator">;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: AuthUser;
}
