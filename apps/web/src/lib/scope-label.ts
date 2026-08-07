import type { AccessLevel } from "@recomenda/api/auth-types";

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
