import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";

/** Rótulo curto do papel na carteira hospedeira (header, menu, banner). */
export function scopeRoleLabel(accessLevel: AccessLevel | undefined): string {
  switch (accessLevel) {
    case "MANAGER":
      return "Gestor";
    case "CONSULTANT":
      return "Consultor";
    case "FARM_MANAGER":
      return "Gerente";
    case "FARM_OPERATOR":
      return "Operador";
    default:
      return "Membro";
  }
}

/** Ex.: "Gestor de Jose Paschoal". */
export function scopeOfLabel(
  agronomistName: string,
  accessLevel: AccessLevel | undefined,
): string {
  const name = agronomistName.trim() || "carteira";
  return `${scopeRoleLabel(accessLevel)} de ${name}`;
}

/**
 * Rótulo do papel da própria conta (herói do perfil). Para STAFF o papel útil
 * é o nível de acesso — "Gestor", "Consultor" — e não a palavra "Equipe".
 */
export function accountRoleLabel(
  role: UserRole | undefined,
  accessLevel: AccessLevel | undefined,
): string {
  switch (role) {
    case "ADMIN":
      return "Administrador";
    case "ORG_ADMIN":
      return "Admin da equipe";
    case "AGRONOMIST":
      return "Agrônomo";
    case "PRODUCER":
      return "Produtor";
    case "STAFF":
      return scopeRoleLabel(accessLevel);
    default:
      return "Conta";
  }
}
