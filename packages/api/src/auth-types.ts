export type UserRole = "ADMIN" | "AGRONOMIST" | "PRODUCER" | "STAFF";

/** Nível de acesso do membro de equipe (só quando role === "STAFF"). */
export type AccessLevel = "MANAGER" | "ASSISTANT";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Presente para role STAFF: MANAGER = Gestor, ASSISTANT = Consultor. */
  access_level?: AccessLevel;
  impersonator?: Omit<AuthUser, "impersonator">;
}

export interface LoginResponse {
  user: AuthUser;
}
