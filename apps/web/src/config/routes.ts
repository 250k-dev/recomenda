import type { Route } from "next";

/**
 * Mapa central de rotas do app.
 *
 * Toda navegação interna deve ser construída a partir daqui — nunca com
 * strings soltas — para que um rename de URL aconteça em um único lugar.
 * Este módulo reflete SEMPRE a árvore de rotas viva; renames em andamento
 * (inglês → pt-BR) trocam apenas os caminhos aqui + a pasta em `src/app`,
 * com redirect permanente no `next.config.ts` para a URL antiga.
 */

/** Contexto propagado via query entre telas encadeadas (produtor/fazenda/safra). */
export type RouteContext = {
  producer_id?: string | null;
  farm_id?: string | null;
  cycle_id?: string | null;
  season_id?: string | null;
  onboarding?: string | null;
};

/** Monta um href tipado a partir de um caminho + query (valores vazios são omitidos). */
export function withQuery(
  path: string,
  query?: Record<string, string | null | undefined>,
): Route {
  if (!query) return path as Route;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return (qs ? `${path}?${qs}` : path) as Route;
}

export const routes = {
  home: "/" as Route,
  login: (opts?: { force?: boolean }) =>
    withQuery("/login", opts?.force ? { force: "1" } : undefined),
  esqueciSenha: "/esqueci-senha" as Route,
  redefinirSenha: "/redefinir-senha" as Route,
  convite: (token: string) => `/convite/${token}` as Route,
  /** Beco informativo para contas de produtor (sem acesso ao painel web). */
  acessoProdutor: "/acesso-produtor" as Route,

  dashboard: "/dashboard" as Route,
  cronograma: (ctx?: RouteContext) => withQuery("/cronograma", ctx),
  perfil: "/perfil" as Route,
  relatorios: "/relatorios" as Route,
  /** Catálogo de produtos do agrônomo (rótulo de menu: "Produtos"). */
  produtos: "/produtos" as Route,
  templatesDeCompra: "/templates-de-compra" as Route,

  produtores: {
    lista: "/produtores" as Route,
    novo: "/produtores/novo" as Route,
    detalhe: (id: string, ctx?: RouteContext & { hash?: string | null }) => {
      const { hash, ...query } = ctx ?? {};
      const href = withQuery(`/produtores/${id}`, query);
      return (hash ? `${href}#${hash}` : href) as Route;
    },
    modeloDeTiming: (
      produtorId: string,
      templateId: string,
      ctx?: RouteContext,
    ) =>
      withQuery(`/produtores/${produtorId}/modelos-de-timing/${templateId}`, ctx),
  },

  equipe: {
    lista: "/equipe" as Route,
    membro: (userId: string) => `/equipe/${userId}` as Route,
  },

  fazendas: {
    lista: "/fazendas" as Route,
    detalhe: (id: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}`, ctx),
    estoque: (id: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/estoque`, ctx),
    talhoes: (id: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/talhoes`, ctx),
    talhao: (id: string, plotId: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/talhoes/${plotId}`, ctx),
    /** Safra da fazenda (ciclo): visão dos talhões programados. */
    safra: (id: string, cycleId: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/safras/${cycleId}`, ctx),
    safraListaDeCompra: (id: string, cycleId: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/safras/${cycleId}/lista-de-compra`, ctx),
    safraPlanoDeCusto: (id: string, cycleId: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/safras/${cycleId}/plano-de-custo`, ctx),
    novaSafra: (id: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/safras/nova`, ctx),
    novaListaDeCompra: (id: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/lista-de-compra/nova`, ctx),
    listaDeCompra: (id: string, listId: string, ctx?: RouteContext) =>
      withQuery(`/fazendas/${id}/lista-de-compra/${listId}`, ctx),
  },

  /**
   * "Safra" aqui é a programação de UM talhão (cronograma de recomendações);
   * a safra da fazenda como um todo vive em `fazendas.safra`.
   */
  safras: {
    lista: "/safras" as Route,
    nova: (ctx?: RouteContext) => withQuery("/safras/nova", ctx),
    /** Tela padrão da safra do talhão: o cronograma de recomendações. */
    cronograma: (id: string, ctx?: RouteContext) =>
      withQuery(`/safras/${id}`, ctx),
    planoDeCusto: (id: string, ctx?: RouteContext) =>
      withQuery(`/safras/${id}/plano-de-custo`, ctx),
    historicoDoTalhao: (id: string, ctx?: RouteContext) =>
      withQuery(`/safras/${id}/historico-do-talhao`, ctx),
  },

  admin: {
    dashboard: "/admin" as Route,
    planos: "/admin/planos" as Route,
    agronomos: {
      lista: "/admin/agronomos" as Route,
      detalhe: (id: string) => `/admin/agronomos/${id}` as Route,
    },
    produtores: {
      lista: "/admin/produtores" as Route,
      detalhe: (id: string) => `/admin/produtores/${id}` as Route,
    },
    catalogoGlobal: "/admin/catalogo-global" as Route,
    perfil: "/admin/perfil" as Route,
  },

  /** Fluxo público de cotação para fornecedores (link com token). */
  cotacao: {
    convite: (token: string) => `/cotacao/${token}` as Route,
    loja: (token: string, responseToken: string) =>
      `/cotacao/${token}/loja/${responseToken}` as Route,
  },
} as const;
