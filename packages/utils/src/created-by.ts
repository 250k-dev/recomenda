/**
 * Rótulo padrão de autoria em listagens e detalhes.
 * Sempre usa o **nome** da pessoa (nunca e-mail).
 */
export function formatCreatedBy(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  return `Criado por: ${trimmed}`;
}
