# Middleware de Autenticação

## O que foi feito

Criado `middleware.ts` na raiz do projeto Next.js.

## Como funciona

O middleware intercepta todas as requisições antes de chegarem às páginas e aplica as seguintes regras:

**Rotas públicas** — passam sem verificação:
- `/login`, `/esqueci-senha`, `/redefinir-senha`, `/convite/*`, `/cotacao/*`, `/api/auth/*`

**Usuário sem cookie `access_token`** — redirecionado para `/login`, exceto se já estiver em rota pública.

**Role PRODUCER** — redirecionado para `/acesso-produtor` (produtores usam o app mobile; se tentarem acessar o web, veem essa página).

**Usuário autenticado em `/login` ou `/`** — redirecionado automaticamente para `/admin` (ADMIN) ou `/dashboard` (AGRONOMIST).

**AGRONOMIST tentando acessar `/admin/*`** — redirecionado para `/dashboard`.

## Cookies usados

| Cookie | Conteúdo | Origem |
|---|---|---|
| `access_token` | JWT de acesso | Gravado pelo route handler `/api/auth/login` |
| `role` | `ADMIN \| AGRONOMIST \| PRODUCER` | Gravado pelo route handler `/api/auth/login` |

Ambos são HTTP-only e definidos pelo route handler existente em `app/api/auth/login/route.ts`.

## O que o middleware NÃO faz

- Não valida a assinatura do JWT — apenas verifica a presença do cookie. A validade real é verificada pelo backend a cada request da API. Se o token expirar, o interceptor do axios (`lib/http/axios.ts`) faz o refresh silencioso via `/api/auth/refresh` e, em caso de falha, redireciona para `/login`.
- Não toca no refresh token — esse fluxo é responsabilidade do axios interceptor no cliente.
