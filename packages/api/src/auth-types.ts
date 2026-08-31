export type UserRole = "ADMIN" | "ORG_ADMIN" | "AGRONOMIST" | "PRODUCER" | "STAFF";

/** Nível de acesso do membro de equipe (só quando role === "STAFF"). */
export type AccessLevel = "MANAGER" | "CONSULTANT" | "FARM_MANAGER" | "FARM_OPERATOR";

/** Carteira de OUTRO agrônomo onde o usuário atua como gestor/consultor. */
export interface MembershipDto {
  agronomist_id: string;
  agronomist_name: string;
  access_level: AccessLevel;
}

export interface MembershipsResponse {
  /** O usuário tem carteira própria (papel de agrônomo)? */
  has_own_carteira: boolean;
  memberships: MembershipDto[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  /** Presente para role STAFF: MANAGER = Gestor, CONSULTANT = Consultor. */
  access_level?: AccessLevel;
  /** Equipe da fazenda: convite/cadastro liberou visualização de preços. */
  price_view?: boolean;
  grants?: string[];
  impersonator?: Omit<AuthUser, "impersonator">;
  /** Presente quando o usuário entrou na carteira de outro agrônomo (escopo ativo). */
  active_scope?: MembershipDto;
  /** Conta nascida de convite de equipe, sem promoção a agrônomo. */
  is_temporary?: boolean;
}

export interface LoginResponse {
  user: AuthUser;
}
