/**
 * Maps an insumo category name to a redesign category color token.
 * tg = variedade/híbrido/semente/fungicida (verde)
 * ta = fertilizante/adubação (âmbar)
 * tc = herbicida (laranja)
 * tb = inseticida / outros / default (azul)
 */
export type CategoryToken = "tg" | "ta" | "tb" | "tc";

export function categoryToken(category?: string | null): CategoryToken {
  const c = (category ?? "").toLowerCase();
  if (
    c.includes("variedade") ||
    c.includes("híbrido") ||
    c.includes("hibrido") ||
    c.includes("semente") ||
    c.includes("fungic")
  ) {
    return "tg";
  }
  if (c.includes("fertil") || c.includes("aduba") || c.includes("nutri")) {
    return "ta";
  }
  if (c.includes("herbic")) return "tc";
  return "tb";
}

/** Solid bar fill class for distribution/category charts. */
export const categoryBarClass: Record<CategoryToken, string> = {
  tg: "bg-tg",
  ta: "bg-ta",
  tb: "bg-tb",
  tc: "bg-tc",
};
