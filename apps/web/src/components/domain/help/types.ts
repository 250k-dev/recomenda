import type { ReactNode } from "react";
import type { Placement } from "react-joyride";
import type { AccessLevel, UserRole } from "@recomenda/api/auth-types";

/** Qual casca hospeda a ajuda — muda o tour da interface e o guia geral. */
export type HelpShell = "agronomist" | "admin";

/** O que a ajuda sabe sobre quem está olhando, para não descrever o que a pessoa não vê. */
export type HelpContext = {
  shell: HelpShell;
  role: UserRole | null;
  accessLevel: AccessLevel | null;
  /** Busca de produtor (⌘K) disponível — Gerente/Operador de fazenda não têm. */
  canSearchProducers: boolean;
  /** Atua em mais de uma carteira (a própria e/ou gestões). */
  hasMultipleScopes: boolean;
};

export type HelpTourStep = {
  /**
   * Valor do atributo `data-tour` do elemento destacado (sem colchetes).
   * `null` = passo centralizado, sem âncora (abertura/fechamento do tour).
   * Passos cujo alvo não está visível quando o tour começa são pulados.
   */
  target: string | null;
  title: string;
  content: ReactNode;
  /** @default "bottom" — a lib reposiciona sozinha se não couber. */
  placement?: Placement | "auto";
};

export type HelpSection = {
  title: string;
  body: ReactNode;
};

export type HelpFormula = {
  name: string;
  /** Uma expressão por linha, em notação legível ("Calda total = vazão × área"). */
  expressions: string[];
  description?: ReactNode;
  /** Exemplo numérico — costuma explicar mais que a fórmula sozinha. */
  example?: string;
};

export type HelpFaqItem = {
  question: string;
  answer: ReactNode;
};

export type HelpGlossaryTerm = {
  term: string;
  definition: ReactNode;
};

export type HelpShortcut = {
  keys: string[];
  description: string;
};

/**
 * Ajuda específica de uma tela. Só `title` é obrigatório: o que faltar é
 * coberto pelo conteúdo genérico (tour da interface, guia geral, cálculos
 * gerais).
 */
export type PageHelp = {
  /** Nome da tela como o usuário a reconhece ("Cronograma da safra"). */
  title: string;
  /** Uma ou duas frases sobre para que a tela serve — topo da documentação. */
  summary?: ReactNode;
  tour?: HelpTourStep[];
  docs?: HelpSection[];
  formulas?: HelpFormula[];
  faq?: HelpFaqItem[];
};
