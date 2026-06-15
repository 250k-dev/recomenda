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

/** Background class for the small category dot (uses the strong fg color). */
export const categoryDotClass: Record<CategoryToken, string> = {
  tg: "bg-tg",
  ta: "bg-ta",
  tb: "bg-tb",
  tc: "bg-tc",
};

/** Soft chip class (soft bg + strong text) for category tags. */
export const categorySoftClass: Record<CategoryToken, string> = {
  tg: "bg-tg-soft text-tg",
  ta: "bg-ta-soft text-ta",
  tb: "bg-tb-soft text-tb",
  tc: "bg-tc-soft text-tc",
};

/** Solid bar fill class for distribution/category charts. */
export const categoryBarClass: Record<CategoryToken, string> = {
  tg: "bg-tg",
  ta: "bg-ta",
  tb: "bg-tb",
  tc: "bg-tc",
};
