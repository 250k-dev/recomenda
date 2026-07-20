#!/usr/bin/env node
/**
 * Verifica ausência de ciclos — uma passada, com `tsconfig.madge.json`.
 *
 * Este script já teve duas passadas e nenhuma delas media o que o nome dizia.
 * O madge não lê o campo `exports` do package.json, então todo import
 * `@recomenda/*` era invisível: 153 arquivos pulados na passada 1, 74 na
 * passada 2, e um ciclo ENTRE PACOTES não era detectado por nenhuma. Medido
 * (auditoria §3), e provado injetando `api → domain` — com `domain → api` já
 * existente, isso é ciclo real, e as duas passadas diziam "No circular
 * dependency found". Com o `tsconfig.madge.json` o mesmo ciclo aparece.
 *
 * Os `paths` desse tsconfig traduzem os `exports` para caminho de disco e
 * resolvem também o `@/*` de `apps/web` — que era a razão de existir a segunda
 * passada. Uma passada cobre as duas coberturas anteriores e mais a que
 * faltava.
 *
 * A checagem de arquivos pulados abaixo é o que impede a regressão: se um
 * pacote novo entrar no workspace sem entrar no `tsconfig.madge.json`, os
 * imports dele ficam invisíveis de novo — e o gate falha em vez de continuar
 * dizendo "nenhum ciclo".
 *
 * Uso: `pnpm check:ciclos`
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Um import pulado é um import que o madge NÃO seguiu. Pular `tailwindcss` é
 * inofensivo — folha de estilo não entra em ciclo de módulo. Pular
 * `@recomenda/*` ou `@/*` é o buraco que este script existe para não ter.
 */
const PREFIXOS_INTERNOS = ["@recomenda/", "@/"];

console.log("\n── madge: workspace inteiro, com resolução de @recomenda/* e @/*");

const r = spawnSync(
  "madge",
  [
    "--circular",
    "--extensions",
    "ts,tsx",
    "--ts-config",
    "tsconfig.madge.json",
    "--warning",
    "packages/",
    "apps/",
  ],
  {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    shell: process.platform === "win32",
  },
);

// `madge` vem do node_modules/.bin do workspace — só está no PATH quando o
// script roda via `pnpm check:ciclos`. Sem esta checagem, um ENOENT (status
// null) cairia no ramo de baixo e seria reportado como "ciclo detectado".
if (r.error) {
  console.error(
    `\n✘ não consegui executar o madge: ${r.error.message}\n` +
      `  Rode via \`pnpm check:ciclos\`, não \`node scripts/check-ciclos.mjs\`.\n`,
  );
  process.exit(1);
}

const saida = r.stdout || "";
process.stdout.write(saida);

if (r.status !== 0) {
  console.error("\n✘ ciclo detectado — ver a saída acima\n");
  process.exit(1);
}

// A lista de pulados vem depois da linha "Skipped N files", um por linha.
const i = saida.search(/Skipped \d+ files/);
const pulados =
  i < 0
    ? []
    : saida
        .slice(saida.indexOf("\n", i) + 1)
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

const internos = pulados.filter((p) =>
  PREFIXOS_INTERNOS.some((prefixo) => p.startsWith(prefixo)),
);

if (internos.length > 0) {
  console.error(
    `\n✘ ${internos.length} import(s) interno(s) que o madge não resolveu:\n` +
      internos.map((p) => `    ${p}`).join("\n") +
      `\n\n  Enquanto um import destes fica invisível, um ciclo que passe por ele\n` +
      `  NÃO é detectado e este gate passa mentindo. Acrescente o pacote ao\n` +
      `  campo "paths" de tsconfig.madge.json.\n`,
  );
  process.exit(1);
}

console.log(
  `✔ nenhum ciclo; ${pulados.length} arquivo(s) pulado(s), nenhum interno\n`,
);
