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

/**
 * Valida um caminho dinâmico contra a árvore de rotas e devolve `Route`.
 *
 * `Route` sem argumento de tipo **não** representa rota dinâmica: o ramo
 * dinâmico do tipo que o Next gera é `T extends ... ? T : never`, e com o
 * default (`T = string`) ele colapsa para `never`. É por isso que
 * `satisfies Route` reprova um `/produtores/${id}` legítimo, e é por isso que o
 * cast na volta é inevitável — o tipo público não sabe dizer "rota dinâmica".
 *
 * Receber o caminho como `Route<T>` faz o `T` ser inferido do template literal:
 * é aí que a checagem acontece. Um typo no trecho estático
 * (`/produtoress/${id}`) reprova no `typecheck` de `apps/web`.
 */
function dynamicRoute<T extends string>(path: Route<T>): Route {
  return path as Route;
}

/**
 * Monta um href tipado a partir de um caminho + query (valores vazios são omitidos).
 *
 * O `path` é validado como `Route<T>` pelo mesmo mecanismo de `dynamicRoute` —
 * ver o comentário de lá para o porquê do genérico e dos casts.
 */
export function withQuery<T extends string>(
  path: Route<T>,
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
  home: "/" satisfies Route,
  login: (opts?: { force?: boolean }) =>
    withQuery("/login", opts?.force ? { force: "1" } : undefined),
  esqueciSenha: "/esqueci-senha" satisfies Route,
  /** Destino do link enviado por e-mail; o token vem no caminho, nunca na query. */
  redefinirSenha: (token: string) => dynamicRoute(`/redefinir-senha/${token}`),
  convite: (token: string) => dynamicRoute(`/convite/${token}`),
  /** Legado: redireciona para o dashboard (produtor acessa o painel web). */
  acessoProdutor: "/acesso-produtor" satisfies Route,

  dashboard: "/dashboard" satisfies Route,
  /** Carteiras de outros agrônomos onde o usuário é gestor/consultor. */
  minhasGestoes: "/minhas-gestoes" satisfies Route,
  cronograma: (ctx?: RouteContext) => withQuery("/cronograma", ctx),
  perfil: "/perfil" satisfies Route,
  relatorios: "/relatorios" satisfies Route,
  /** Catálogo de produtos do agrônomo (rótulo de menu: "Produtos"). */
  produtos: "/produtos" satisfies Route,
  templatesDeCompra: "/templates-de-compra" satisfies Route,

  produtores: {
    lista: "/produtores" satisfies Route,
    novo: "/produtores/novo" satisfies Route,
    detalhe: (id: string, ctx?: RouteContext & { hash?: string | null }) => {
      const { hash, ...query } = ctx ?? {};
      const href = withQuery(`/produtores/${id}`, query);
      // O caminho já foi validado pelo `withQuery`; o `#hash` é sufixo livre.
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
    lista: "/equipe" satisfies Route,
    membro: (userId: string) => dynamicRoute(`/equipe/${userId}`),
  },

  fazendas: {
    lista: "/fazendas" satisfies Route,
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
    lista: "/safras" satisfies Route,
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
    dashboard: "/admin" satisfies Route,
    planos: "/admin/planos" satisfies Route,
    agronomos: {
      lista: "/admin/agronomos" satisfies Route,
      detalhe: (id: string) => dynamicRoute(`/admin/agronomos/${id}`),
    },
    produtores: {
      lista: "/admin/produtores" satisfies Route,
      detalhe: (id: string) => dynamicRoute(`/admin/produtores/${id}`),
    },
    /** Tipado com cast até o Next regenerar `.next/types` com a rota nova. */
    equipe: "/admin/equipe" as Route,
    equipes: "/admin/equipes" as Route,
    catalogoGlobal: "/admin/catalogo-global" satisfies Route,
    perfil: "/admin/perfil" satisfies Route,
  },

  /** Fluxo público de cotação para fornecedores (link com token). */
  cotacao: {
    convite: (token: string) => dynamicRoute(`/cotacao/${token}`),
    loja: (token: string, responseToken: string) =>
      dynamicRoute(`/cotacao/${token}/loja/${responseToken}`),
  },
} as const;
