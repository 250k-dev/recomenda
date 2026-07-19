#!/usr/bin/env node
/**
 * Verifica ausência de ciclos, em duas passadas — e as duas são necessárias.
 *
 * 1. Workspace (`packages/ apps/`) a partir da raiz: pega ciclos dentro de cada
 *    pacote e entre arquivos do app por caminho relativo.
 * 2. Dentro de `apps/web`, com o `tsconfig.json` dele: é a única forma de
 *    resolver o alias `@/*`. Os `paths` do tsconfig são relativos ao diretório
 *    dele, então rodar da raiz apontando `--ts-config apps/web/tsconfig.json`
 *    NÃO resolve — foi medido: a passada 1 sozinha dava "no circular
 *    dependency" enquanto existia um ciclo real via `@/components/...`.
 *
 * Uso: `pnpm check:ciclos`
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PASSADAS = [
  {
    nome: "workspace (packages/ + apps/)",
    cwd: ROOT,
    args: ["--circular", "--extensions", "ts,tsx", "packages/", "apps/"],
  },
  {
    nome: "apps/web com resolução de @/*",
    cwd: path.join(ROOT, "apps", "web"),
    args: ["--circular", "--extensions", "ts,tsx", "--ts-config", "tsconfig.json", "src/"],
  },
];

let falhou = false;

for (const p of PASSADAS) {
  console.log(`\n── madge: ${p.nome}`);
  const r = spawnSync("madge", p.args, {
    cwd: p.cwd,
    encoding: "utf8",
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) falhou = true;
}

if (falhou) {
  console.error("\n✘ ciclo detectado — ver a saída acima\n");
  process.exit(1);
}
console.log("\n✔ nenhum ciclo nas duas passadas\n");
