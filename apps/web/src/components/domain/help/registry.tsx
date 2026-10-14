import {
  listaDeCompraHelp,
  montarListaDeCompraHelp,
} from "./pages/lista-de-compra";
import type { PageHelp } from "./types";

/**
 * Ajuda por tela, indexada pelo padrão de rota — o mesmo caminho da pasta em
 * `src/app`, sem o grupo: `(agronomist)/safras/[id]/page.tsx` → `/safras/[id]`.
 *
 * Toda tela autenticada já tem uma entrada, por enquanto só com o título. Para
 * aprofundar uma tela, preencha os campos de `PageHelp` na entrada dela:
 *
 * ```tsx
 * "/safras/[id]": {
 *   title: "Cronograma da safra",
 *   summary: "As etapas de aplicação do talhão, na ordem em que vencem.",
 *   tour: [
 *     // `target` casa com `data-tour="cronograma-etapas"` no elemento da tela.
 *     { target: "cronograma-etapas", title: "Etapas", content: "…" },
 *   ],
 *   docs: [{ title: "Registrar uma aplicação", body: <p>…</p> }],
 *   formulas: [{ name: "DAP", expressions: ["DAP = data − plantio"] }],
 *   faq: [{ question: "…", answer: "…" }],
 * },
 * ```
 *
 * O que ficar vazio cai no conteúdo genérico de `generic-help.tsx`.
 *
 * Tela com conteúdo de verdade ganha um arquivo em `pages/` (ver
 * `pages/lista-de-compra.tsx`) e a entrada aqui só espalha o objeto: o
 * registro continua um índice legível das rotas.
 */
const PAGE_HELP: Record<string, PageHelp> = {
  // ---- Área do agrônomo / equipe / produtor ----
  "/dashboard": { title: "Início" },
  "/cronograma": { title: "Cronograma" },
  "/minhas-gestoes": { title: "Minhas Gestões" },
  "/relatorios": { title: "Relatórios" },
  "/produtos": { title: "Catálogo de produtos" },
  "/templates-de-compra": { title: "Templates de compra" },

  "/produtores": { title: "Produtores" },
  "/produtores/novo": { title: "Novo produtor" },
  "/produtores/[id]": { title: "Produtor" },
  "/produtores/[id]/historico": { title: "Histórico do produtor" },
  "/produtores/[id]/safras-arquivadas": { title: "Safras arquivadas" },
  "/produtores/[id]/modelos-de-timing/[templateId]": {
    title: "Modelo de timing",
  },

  "/fazendas": { title: "Fazendas" },
  "/fazendas/[id]": { title: "Fazenda" },
  "/fazendas/[id]/estoque": { title: "Estoque da fazenda" },
  "/fazendas/[id]/talhoes": { title: "Talhões" },
  "/fazendas/[id]/talhoes/[plotId]": { title: "Talhão" },
  "/fazendas/[id]/safras/nova": { title: "Nova safra" },
  "/fazendas/[id]/safras/[cycleId]": { title: "Safra da fazenda" },
  "/fazendas/[id]/safras/[cycleId]/lista-de-compra": {
    title: "Lista de compra da safra",
    ...listaDeCompraHelp,
  },
  "/fazendas/[id]/safras/[cycleId]/lista-de-compra/cotacoes": {
    title: "Cotações",
  },
  "/fazendas/[id]/safras/[cycleId]/plano-de-custo": {
    title: "Plano de custo da safra",
  },
  // Também retoma o rascunho da lista da safra.
  "/fazendas/[id]/lista-de-compra/nova": {
    title: "Montar lista de compra",
    ...montarListaDeCompraHelp,
  },
  // Visão só-leitura: os passos de edição do tour somem sozinhos (sem alvo).
  "/fazendas/[id]/lista-de-compra/[listId]": {
    title: "Lista de compra",
    ...listaDeCompraHelp,
  },

  // "Safra" em `/safras` é a programação de UM talhão (ver `routes.safras`).
  "/safras/nova": { title: "Nova programação de talhão" },
  "/safras/[id]": { title: "Cronograma da safra" },
  "/safras/[id]/plano-de-custo": { title: "Plano de custo do talhão" },
  "/safras/[id]/historico-do-talhao": { title: "Histórico do talhão" },

  "/equipe": { title: "Equipe" },
  "/equipe/auditoria": { title: "Auditoria da equipe" },
  "/equipe/[userId]": { title: "Membro da equipe" },

  "/perfil": { title: "Meu perfil" },
  "/perfil/lico": { title: "Lico" },
  "/perfil/lico/ocorrencias": { title: "Ocorrências do Lico" },

  // ---- Administração ----
  "/admin": { title: "Painel administrativo" },
  "/admin/planos": { title: "Planos" },
  "/admin/agronomos": { title: "Agrônomos" },
  "/admin/agronomos/[id]": { title: "Agrônomo" },
  "/admin/produtores": { title: "Produtores" },
  "/admin/produtores/[id]": { title: "Produtor" },
  "/admin/equipes": { title: "Equipes" },
  "/admin/equipe": { title: "Membros" },
  "/admin/catalogo-global": { title: "Catálogo global" },
  "/admin/perfil": { title: "Meu perfil" },
};

type CompiledPattern = {
  regex: RegExp;
  /** Segmentos fixos: `/safras/nova` vence `/safras/[id]` para "/safras/nova". */
  staticSegments: number;
  help: PageHelp;
};

const COMPILED: CompiledPattern[] = Object.entries(PAGE_HELP).map(
  ([pattern, help]) => {
    const segments = pattern.split("/").filter(Boolean);
    const source = segments
      .map((segment) =>
        /^\[[^\]]+\]$/.test(segment)
          ? "[^/]+"
          : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("/");
    return {
      regex: new RegExp(`^/${source}/?$`),
      staticSegments: segments.filter((s) => !s.startsWith("[")).length,
      help,
    };
  },
);

/** Ajuda da tela no `pathname` (sem query), ou `null` se a rota não tem entrada. */
export function resolvePageHelp(pathname: string): PageHelp | null {
  let best: CompiledPattern | null = null;
  for (const entry of COMPILED) {
    if (!entry.regex.test(pathname)) continue;
    if (!best || entry.staticSegments > best.staticSegments) best = entry;
  }
  return best?.help ?? null;
}
