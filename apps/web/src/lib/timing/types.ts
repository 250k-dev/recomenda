/**
 * Tipos do cronograma (timing) compartilhados entre a edição na tela e a
 * sincronização com a API. Vivem em `lib/` porque `lib/timing/sync-stage-products`
 * opera sobre eles — a camada de baixo não pode importar do componente.
 */

/** Produto de uma etapa do cronograma, no estado de rascunho do editor. */
export type StageProductDraft = {
  key: string;
  category: string;
  productId: string;
  productName: string;
  dose: string;
  unit: string;
  mixItemId?: string;
  /** Produto fora da lista de compra (fora da programação). */
  outOfProgram?: boolean;
};
