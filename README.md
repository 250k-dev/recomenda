# Recomenda

Aplicação web que agrônomos usam para planejar a safra dos seus produtores:
cadastro de fazendas e talhões, modelos de timing de aplicação, plano de custo,
lista de compra e cotação com fornecedores por link público.

É o front-end. A API é um Nest separado, fora deste repo — veja
`apps/web/.env.example` para apontar para ela.

## Como subir

Pré-requisitos: **Node 22** e **pnpm 11.15.0** (fixado em `packageManager`;
`corepack enable` resolve a versão sozinho).

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # as 3 vars são opcionais, têm default
pnpm dev                                 # http://localhost:3000
```

## Estrutura

Monorepo pnpm + turbo. Um app, sete pacotes:

```
apps/web/      # o Next.js app — o único app
packages/      # utils, config, api, domain, api-hooks, ui, tsconfig
```

**Quem pode importar quem é regra de lint, não convenção.** A tabela do grafo,
os invariantes de fronteira e o que fazer ao criar um pacote novo estão no
[`AGENTS.md`](./AGENTS.md) — leia antes de mover código entre pacotes.

## Gates

Os cinco rodam no CI e devem passar antes de abrir PR:

```bash
pnpm lint               # eslint . na RAIZ — cobre apps/ E packages/
pnpm typecheck          # 7 pacotes
pnpm build
pnpm check:ciclos       # dependência circular
pnpm test:fronteiras    # as regras de fronteira ainda pegam violação?
```

## Não há testes automatizados

Zero arquivos de teste no repo. Os gates acima provam que compila e que as
fronteiras valem — **não** provam que a conta está certa.

Mudança em cálculo, formatação de moeda, agregação de safra, lista de compra ou
classe de Tailwind exige **smoke manual**: subir o app, abrir a tela afetada e
conferir contra o esperado.
