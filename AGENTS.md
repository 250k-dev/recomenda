<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Este repo é um monorepo pnpm + turbo

```
apps/web/           # o Next.js app — o único app
  src/app/          # rotas
  src/components/   # domain/ (feature code), layout/, auth/
  src/stores/       # zustand
  src/lib/auth/     # session.ts e session-cookies.ts — server-only, ficam aqui
  src/config/nav.ts # usa `Route` do next: não pode virar pacote
  proxy.ts          # Next 16 renomeou middleware.ts → proxy.ts
packages/
  utils/            # @recomenda/utils      — formatação, datas, constantes
  config/           # @recomenda/config     — env validada + routes.ts
  api/              # @recomenda/api        — transporte (axios) e fetchers
  domain/           # @recomenda/domain     — lógica de negócio pura
  api-hooks/        # @recomenda/api-hooks  — camada React Query
  ui/               # @recomenda/ui         — primitivos de apresentação
  tsconfig/         # configs base de TS
```

`components/domain` (17,9k linhas) **não** é pacote de propósito: é código de
feature com um único consumidor. Extrair custa caro e não devolve nada.

## O que pode importar o quê

| Pacote | Pode importar |
|---|---|
| `utils` | nada interno |
| `config` | nada interno |
| `api` | `utils` |
| `domain` | `api`, `utils` |
| `api-hooks` | `api`, `domain`, `utils` |
| `ui` | `utils` |
| `apps/web` | todos |

Mais três invariantes que não são sobre o grafo:

- **`domain` não conhece React.** Sem `react`, `next/*` ou `@tanstack/*`. Um
  arquivo que precise disso pertence a `api-hooks` (se for hook) ou a
  `apps/web` (se for componente).
- **`ui` não conhece Next.** `typedRoutes` gera os tipos de rota a partir de
  `apps/web`, e um componente dentro do pacote não os enxerga. Se um primitivo
  precisa navegar, ele recebe `href: string`/`onClick` por prop e quem monta o
  `<Link>` é o app.
- **`@/*` só existe dentro de `apps/web`.** Em `packages/`, import cruzado usa
  `@recomenda/*`.

**`pnpm lint` reprova violação de qualquer um desses.** Não é convenção: são
regras de ESLint na config da raiz, e `pnpm test:fronteiras` verifica que elas
continuam pegando violação de verdade.

Ao criar um pacote novo, edite a tabela `GRAFO` no topo de `eslint.config.mjs` —
as regras são geradas a partir dela. Quem não estiver na tabela nasce proibido
de importar qualquer coisa interna, que é o default correto.

## Comandos

```bash
pnpm dev                # turbo dev
pnpm build              # turbo build (cache; 2ª vez deve dar >>> FULL TURBO)
pnpm lint               # eslint . na RAIZ — cobre apps/ e packages/
pnpm typecheck          # turbo typecheck (7 pacotes)
pnpm check:ciclos       # madge, 2 passadas (ver o script: a 2ª é necessária)
pnpm test:fronteiras    # as regras de fronteira ainda pegam violação?
```

Não use `turbo lint` — a task foi removida do `turbo.json` porque só enxergava
`apps/web` e deixava `packages/` fora do gate.

## Não há testes automatizados

Nenhum. Zero arquivos de teste no repo. Consequência prática: **mudança em
cálculo, formatação de moeda, agregação de safra ou geração de lista de compra
exige smoke manual** — subir o app, abrir a tela afetada e conferir os números
contra o esperado. `pnpm build` passar não diz nada sobre correção de conta.

O histórico da migração para monorepo está em `docs/monorepo/` (gitignored),
com o baseline de números por fazenda/safra usado nas verificações de A3–A7.
