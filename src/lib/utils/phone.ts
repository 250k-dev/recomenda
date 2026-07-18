/**
 * Telefones chegam da API em formatos variados — com ou sem o DDI +55, com ou
 * sem máscara. Na interface mostramos sempre só o número nacional mascarado:
 * o +55 é implícito para todo mundo e só atrapalha a leitura.
 */

/**
 * Só os dígitos do número nacional (DDD + assinante), no máximo 11.
 *
 * O DDI 55 só é descartado quando sobra sobre um número completo (12–13
 * dígitos). Um número de 11 dígitos começando em 55 é DDD 55 (Santa Maria/RS),
 * não DDI — cortar ali mutilaria o telefone.
 */
export function phoneDigitsBR(raw: string | null | undefined) {
  const digits = (raw ?? "").replace(/\D/g, "");
  const national =
    digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  return national.slice(0, 11);
}

/**
 * Máscara progressiva, para usar no `onChange` dos inputs: formata conforme o
 * usuário digita, sem exigir o número completo. Celular (11 dígitos) vira
 * `(11) 99999-8888`; fixo (10) vira `(11) 3333-4444`.
 */
export function maskPhoneBR(raw: string | null | undefined) {
  const d = phoneDigitsBR(raw);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;

  const isMobile = d.length > 10;
  const ddd = d.slice(0, 2);
  const head = isMobile ? d.slice(2, 7) : d.slice(2, 6);
  const tail = isMobile ? d.slice(7) : d.slice(6);

  return tail ? `(${ddd}) ${head}-${tail}` : `(${ddd}) ${head}`;
}

/** Versão de exibição: cai no `fallback` quando não há número cadastrado. */
export function formatPhoneBR(
  raw: string | null | undefined,
  fallback = "—",
): string {
  return maskPhoneBR(raw) || fallback;
}
