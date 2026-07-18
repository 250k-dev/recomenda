import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

// Raiz do monorepo. Fixada explicitamente porque, com múltiplos package.json
// na árvore, o Next pode inferir a raiz errada do workspace.
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const nextConfig: NextConfig = {
  turbopack: {
    root: monorepoRoot,
    resolveAlias: {
      "date-fns/locale": "date-fns/locale.js",
    },
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Pacotes internos publicados como TypeScript cru (sem step de build): o Next
  // precisa transpilá-los junto com o app.
  transpilePackages: ["@recomenda/utils"],
  // Valida em tempo de compilação todo href/push interno (links quebrados
  // viram erro de type-check em vez de 404 em produção).
  typedRoutes: true,
  // URLs antigas (em inglês) → novas (pt-BR). Permanentes (308) para que
  // links salvos, e-mails já enviados e favoritos continuem funcionando.
  async redirects() {
    return [
      // ---- Públicas ----
      { source: "/forgot-password", destination: "/esqueci-senha", permanent: true },
      { source: "/reset-password", destination: "/redefinir-senha", permanent: true },
      { source: "/invite/:path*", destination: "/convite/:path*", permanent: true },
      { source: "/producer-only", destination: "/acesso-produtor", permanent: true },
      // ---- Telas que eram "?tab=" e viraram subrota ----
      {
        source: "/fazendas/:id",
        has: [{ type: "query", key: "tab", value: "stock" }],
        destination: "/fazendas/:id/estoque",
        permanent: true,
      },
      {
        source: "/fazendas/:id",
        has: [{ type: "query", key: "tab", value: "plots" }],
        destination: "/fazendas/:id/talhoes",
        permanent: true,
      },
      {
        source: "/fazendas/:id/safras/:cycleId",
        has: [{ type: "query", key: "tab", value: "purchase" }],
        destination: "/fazendas/:id/safras/:cycleId/lista-de-compra",
        permanent: true,
      },
      {
        source: "/fazendas/:id/safras/:cycleId",
        has: [{ type: "query", key: "tab", value: "cost-plan" }],
        destination: "/fazendas/:id/safras/:cycleId/plano-de-custo",
        permanent: true,
      },
      {
        source: "/safras/:id",
        has: [{ type: "query", key: "tab", value: "cost-plan" }],
        destination: "/safras/:id/plano-de-custo",
        permanent: true,
      },
      {
        source: "/safras/:id",
        has: [{ type: "query", key: "tab", value: "plot-history" }],
        destination: "/safras/:id/historico-do-talhao",
        permanent: true,
      },
      // ---- Fazendas e safras (as regras específicas vêm antes das genéricas) ----
      { source: "/farms/:id/plots/:path*", destination: "/fazendas/:id/talhoes/:path*", permanent: true },
      { source: "/farms/:id/cycles/:path*", destination: "/fazendas/:id/safras/:path*", permanent: true },
      { source: "/farms/:id/season/new", destination: "/fazendas/:id/safras/nova", permanent: true },
      { source: "/farms/:id/purchase-list/new", destination: "/fazendas/:id/lista-de-compra/nova", permanent: true },
      { source: "/farms/:id/purchase-list/:path*", destination: "/fazendas/:id/lista-de-compra/:path*", permanent: true },
      { source: "/farms/:path*", destination: "/fazendas/:path*", permanent: true },
      { source: "/seasons/new", destination: "/safras/nova", permanent: true },
      { source: "/seasons/:path*", destination: "/safras/:path*", permanent: true },
      // ---- Área do agrônomo (nível 1) ----
      { source: "/producers/new", destination: "/produtores/novo", permanent: true },
      { source: "/producers/:id/timing-templates/:path*", destination: "/produtores/:id/modelos-de-timing/:path*", permanent: true },
      { source: "/producers/:path*", destination: "/produtores/:path*", permanent: true },
      { source: "/catalog", destination: "/produtos", permanent: true },
      { source: "/reports", destination: "/relatorios", permanent: true },
      { source: "/consultants/:path*", destination: "/equipe/:path*", permanent: true },
      { source: "/profile", destination: "/perfil", permanent: true },
      { source: "/compra-templates", destination: "/templates-de-compra", permanent: true },
      // Rotas antigas que já eram só um redirect interno para /producers.
      { source: "/timing-templates/:path*", destination: "/produtores", permanent: true },
      { source: "/mix-templates/:path*", destination: "/produtores", permanent: true },
      // ---- Admin ----
      { source: "/admin/plans", destination: "/admin/planos", permanent: true },
      { source: "/admin/agronomists/:path*", destination: "/admin/agronomos/:path*", permanent: true },
      { source: "/admin/producers/:path*", destination: "/admin/produtores/:path*", permanent: true },
      { source: "/admin/global-catalog", destination: "/admin/catalogo-global", permanent: true },
      { source: "/admin/profile", destination: "/admin/perfil", permanent: true },
    ];
  },
};

export default nextConfig;
