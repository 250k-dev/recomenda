import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// -----------------------------------------------------------------------------
// O grafo de dependências de docs/monorepo/00-arquitetura.md, em forma de dado.
// Editar esta tabela é a única coisa que precisa mudar quando um pacote novo
// entrar: as duas camadas de enforcement abaixo são geradas a partir dela.
// -----------------------------------------------------------------------------
const GRAFO = {
  utils: [],
  config: [],
  api: ["utils"],
  domain: ["api", "utils"],
  "api-hooks": ["api", "domain", "utils"],
  ui: ["utils"],
  // `apps/web` pode importar todos — é a folha do grafo, não recebe restrição.
};

const PACOTES = Object.keys(GRAFO);

/**
 * Padrões que negam todo `@recomenda/*` e reabrem só os permitidos.
 * A negação é o que faz a regra valer para pacote futuro: quem for criado
 * amanhã já nasce proibido até ser liberado aqui.
 * `@recomenda/x/**` cobre os imports profundos (`@recomenda/ui/popover`).
 */
function negarRecomendaExceto(permitidos) {
  return [
    "@recomenda/*",
    "@recomenda/*/**",
    ...permitidos.flatMap((p) => [`!@recomenda/${p}`, `!@recomenda/${p}/**`]),
    // `tsconfig` é consumido por `extends` de tsconfig, nunca por import de TS,
    // mas negá-lo produziria erro confuso se alguém tentasse.
    "!@recomenda/tsconfig",
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  // Os padrões são resolvidos a partir da raiz do monorepo (onde vive este
  // arquivo), por isso o `**/` — sem ele, `.next/**` não casaria com
  // `apps/web/.next/`.
  globalIgnores([
    "**/node_modules/**",
    // Default ignores of eslint-config-next:
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    // Mockups de design versionados fora do git (`.gitignore:45`). Não são
    // código-fonte do app; sozinhos respondiam por 14 dos 36 achados quando o
    // lint passou a varrer a raiz.
    "docs/design-refactor/**",
  ]),

  // O eslint roda da raiz, mas o app Next vive em `apps/web`. Sem isto o
  // plugin do Next procura `pages/`/`app/` na raiz, não acha, e imprime
  // "Pages directory cannot be found" em toda execução — ruído em log de CI, e
  // as regras que dependem do diretório de rotas ficam sem base.
  {
    settings: { next: { rootDir: "apps/web" } },
  },

  // ===========================================================================
  // CAMADA 1 — fronteiras por nome de pacote (`@recomenda/*`)
  //
  // Por que esta camada existe, e por que ela é a principal:
  // o `boundaries/dependencies` da Camada 2 classifica o alvo do import
  // *resolvendo o módulo*. Sob pnpm, `packages/ui/node_modules/@recomenda/api`
  // só existe se `ui` declarar `api` como dependência — e um import que viola o
  // grafo é, por definição, um import não declarado. Resultado: o alvo fica
  // irresolvível e a regra passa em silêncio. Medido: com o symlink presente o
  // boundaries acusa `ui → api`; sem ele, não acusa nada.
  //
  // `no-restricted-imports` casa a string do import e não depende de resolução
  // nenhuma, então não tem esse ponto cego.
  // ===========================================================================
  ...PACOTES.map((pkg) => ({
    files: [`packages/${pkg}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: negarRecomendaExceto(GRAFO[pkg]),
              message:
                `Fronteira violada: @recomenda/${pkg} só pode importar ` +
                `${GRAFO[pkg].length ? GRAFO[pkg].map((d) => `@recomenda/${d}`).join(", ") : "(nenhum pacote interno)"}. ` +
                `Ver o grafo em docs/monorepo/00-arquitetura.md.`,
            },
            // `domain` é lógica de negócio pura: sem React, sem Next, sem React
            // Query. Um arquivo daqui que precise de qualquer um dos três está
            // no pacote errado — o destino dele é `api-hooks` ou `apps/web`.
            ...(pkg === "domain"
              ? [
                  {
                    group: [
                      "react",
                      "react/*",
                      "react-dom",
                      "react-dom/*",
                      "next",
                      "next/*",
                      "@tanstack/*",
                    ],
                    message:
                      "@recomenda/domain é lógica de negócio pura e não pode conhecer React/Next/React Query. Hook vai para @recomenda/api-hooks; componente vai para apps/web.",
                  },
                ]
              : []),
            // `ui` não pode importar Next. É a armadilha do `typedRoutes`
            // descrita em 00-arquitetura.md: os tipos de rota são gerados a
            // partir de `apps/web` e um componente dentro do pacote não os
            // enxerga.
            ...(pkg === "ui"
              ? [
                  {
                    group: ["next", "next/*"],
                    message:
                      "@recomenda/ui não pode importar Next (armadilha do typedRoutes). Se o componente precisa navegar, receba `href: string`/`onClick` por prop e monte o <Link> em apps/web.",
                  },
                ]
              : []),
          ],
        },
      ],
    },
  })),

  // ===========================================================================
  // CAMADA 2 — fronteiras por caminho de arquivo
  //
  // Cobre o ponto cego da Camada 1: um import que escapa do pacote por caminho
  // relativo (`../../api/src/index`) não casa nenhum padrão `@recomenda/*`.
  // Aqui a resolução funciona, porque o caminho relativo sempre resolve.
  // ===========================================================================
  {
    files: ["packages/**/*.{ts,tsx}", "apps/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      // `api-hooks` vem antes de `api`: o primeiro descritor que casa vence, e
      // um pattern que seja prefixo do outro roubaria os arquivos.
      "boundaries/elements": [
        { type: "apiHooks", pattern: "packages/api-hooks" },
        { type: "api", pattern: "packages/api" },
        { type: "utils", pattern: "packages/utils" },
        { type: "config", pattern: "packages/config" },
        { type: "domain", pattern: "packages/domain" },
        { type: "ui", pattern: "packages/ui" },
        { type: "app", pattern: "apps/web" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "Fronteira violada: {{from.element.type}} não pode importar {{to.element.type}}. Ver o grafo permitido em docs/monorepo/00-arquitetura.md.",
          policies: [
            {
              from: { element: { types: "api" } },
              allow: { to: { element: { types: "utils" } } },
            },
            {
              from: { element: { types: "domain" } },
              allow: { to: { element: { types: { anyOf: ["api", "utils"] } } } },
            },
            {
              from: { element: { types: "apiHooks" } },
              allow: {
                to: { element: { types: { anyOf: ["api", "domain", "utils"] } } },
              },
            },
            {
              from: { element: { types: "ui" } },
              allow: { to: { element: { types: "utils" } } },
            },
            {
              from: { element: { types: "app" } },
              allow: {
                to: {
                  element: {
                    types: {
                      anyOf: [
                        "utils",
                        "config",
                        "api",
                        "domain",
                        "apiHooks",
                        "ui",
                      ],
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
