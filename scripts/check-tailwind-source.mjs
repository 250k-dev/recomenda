#!/usr/bin/env node
/**
 * Verifica que o scanner do Tailwind enxerga TODOS os pacotes de `packages/`.
 *
 * Por que isto existe:
 * o Tailwind v4 gera classe a partir das strings que encontra varrendo
 * arquivos. A árvore que ele varre por padrão é a do app; tudo que mora em
 * `packages/` só entra por uma diretiva `@source` em `globals.css`. Quando um
 * pacote fica de fora, as classes dele simplesmente não são geradas: **o build
 * passa, não há warning, e a tela quebra em produção.**
 *
 * Não é hipótese. `packages/utils` ficou fora do `@source` da Fase 2 até a
 * auditoria — sete fases —, e nesse tempo os botões "Desativar" de 8 telas
 * ficaram sem o laranja e as barras de `/relatorios` sem preenchimento.
 * Sobreviveu a uma comparação pixel-a-pixel (tirou o baseline depois da
 * quebra), a um side-by-side de 24 telas (comparava `innerText`, que não
 * enxerga CSS) e a dois handoffs que avisavam por escrito. A conclusão da
 * auditoria foi que isto precisa de gate no CI, não de vigilância humana.
 *
 * Como funciona:
 * injeta em cada pacote uma classe sentinela com valor arbitrário — uma que
 * não existe em lugar nenhum do repo —, roda o build de produção e procura a
 * regra no CSS emitido. Sentinela ausente = pacote fora do `@source`.
 *
 * A sentinela é o método certo em vez de listar classes reais porque não
 * envelhece: o gate testa a COBERTURA do `@source`, não o conteúdo de hoje. As
 * classes reais mudam — `bg-tg-soft` e `bg-tc-soft` serviam de prova no B1 e
 * deixaram de existir no B3, quando `categorySoftClass` foi apagado por ser
 * código morto. Uma tabela de classes reais teria virado falso positivo.
 *
 * A exigência é os SEIS pacotes, não só os dois que hoje emitem classe. É o
 * que o B1 decidiu ao apontar o `@source` para o diretório `packages` inteiro
 * em vez de uma linha por pacote: a causa-raiz do bug não foi errar um
 * caminho, foi depender de alguém lembrar de vir aqui ao criar pacote. Este
 * script transforma essa decisão em regra executável.
 *
 * ⚠️ As sentinelas NÃO podem entrar no `.gitignore`: o scanner do Tailwind
 * pula arquivo gitignorado, e o turbo não hasheia arquivo gitignorado — as
 * duas coisas fariam o gate dar falso NEGATIVO (passar sem ter medido).
 * A limpeza é por handler de sinal + varredura na entrada.
 *
 * Uso: `pnpm check:tailwind`
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR_PACOTES = path.join(ROOT, "packages");
const CSS_DE_PRODUCAO = path.join(ROOT, "apps", "web", ".next", "static");
const NOME_SENTINELA = "__tailwind_sentinela__.ts";

// `@recomenda/tsconfig` não tem `src/` — é só JSON de config.
const PACOTES = readdirSync(DIR_PACOTES, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name !== "tsconfig")
  .map((d) => d.name)
  .sort();

// Valor arbitrário: o Tailwind gera `.mt-\[9101px\]{margin-top:9101px}` para
// qualquer um destes, e nenhum aparece em lugar nenhum do repo.
const sentinelaDe = (i) => `mt-[${9101 + i}px]`;

// Controles. Sem eles, um script que não achasse o CSS reportaria "tudo
// ausente" (falso positivo) e um que casasse qualquer coisa reportaria "tudo
// presente" (falso negativo). Os dois têm que dar o resultado esperado para a
// leitura das sentinelas valer.
const CONTROLE_POSITIVO = "bg-card"; // vem de apps/web, tem que estar sempre
const CONTROLE_NEGATIVO = "mt-[9199px]"; // não injetada em lugar nenhum

const escritos = new Set();

function limpar() {
  for (const p of escritos) rmSync(p, { force: true });
  escritos.clear();
}

function limparOrfas() {
  const orfas = PACOTES.map((p) =>
    path.join(DIR_PACOTES, p, "src", NOME_SENTINELA),
  ).filter((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
  for (const p of orfas) rmSync(p, { force: true });
  if (orfas.length) console.log(`  (${orfas.length} sentinela(s) órfã(s) apagada(s))`);
}

for (const sinal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(sinal, () => {
    limpar();
    process.exit(130);
  });
}
process.on("exit", limpar);
process.on("uncaughtException", (e) => {
  limpar();
  console.error(e);
  process.exit(1);
});

limparOrfas();

console.log(`\n── injetando sentinela em ${PACOTES.length} pacotes\n`);

const alvos = PACOTES.map((pkg, i) => {
  const classe = sentinelaDe(i);
  const arquivo = path.join(DIR_PACOTES, pkg, "src", NOME_SENTINELA);
  writeFileSync(
    arquivo,
    `// Gerado por scripts/check-tailwind-source.mjs. Se este arquivo sobreviveu\n` +
      `// a uma execução, pode apagar: ele existe só durante o gate.\n` +
      `export const sentinela = "${classe}";\n`,
  );
  escritos.add(arquivo);
  console.log(`  ${pkg.padEnd(10)} ${classe}`);
  return { pkg, classe };
});

console.log(`\n── build de produção (o CSS só sai daqui)\n`);

const build = spawnSync("pnpm", ["build"], {
  cwd: ROOT,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
  shell: process.platform === "win32",
});

if (build.status !== 0) {
  limpar();
  console.error("\n✘ o build falhou; sem CSS para medir\n");
  console.error((build.stdout || "").slice(-3000));
  process.exit(1);
}

// Só `.next/static` — `.next/dev` é do dev server e pode estar de outra época.
function cssDeProducao(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? cssDeProducao(path.join(dir, d.name))
      : d.name.endsWith(".css")
        ? [path.join(dir, d.name)]
        : [],
  );
}

let arquivosCss;
try {
  arquivosCss = cssDeProducao(CSS_DE_PRODUCAO);
} catch {
  arquivosCss = [];
}

if (arquivosCss.length === 0) {
  limpar();
  console.error(
    `\n✘ nenhum CSS em ${path.relative(ROOT, CSS_DE_PRODUCAO)} — o gate não mediu nada.\n` +
      `  Se o Next mudou o diretório de saída, este script precisa acompanhar.\n`,
  );
  process.exit(1);
}

const css = arquivosCss.map((f) => readFileSync(f, "utf8")).join("\n");
const bytes = css.length;

limpar();

// O CSS emitido escapa os colchetes: `mt-[9101px]` vira `.mt-\[9101px\]`.
// Procurar o valor (`9101px`) casa tanto o seletor quanto a declaração e não
// depende da forma do escape.
const presente = (classe) => css.includes(classe.replace(/^mt-\[|\]$/g, ""));

console.log(
  `\n── ${arquivosCss.length} arquivo(s) CSS, ${bytes.toLocaleString("pt-BR")} bytes\n`,
);

let falhas = 0;

console.log("=== CONTROLES ===\n");
const posOk = css.includes(CONTROLE_POSITIVO);
const negOk = !css.includes(CONTROLE_NEGATIVO.replace(/^mt-\[|\]$/g, ""));
if (!posOk) falhas++;
if (!negOk) falhas++;
console.log(
  `  ${posOk ? "✔" : "✘"} positivo  ${CONTROLE_POSITIVO} (de apps/web) ${posOk ? "presente" : "AUSENTE — o gate não está lendo o CSS certo"}`,
);
console.log(
  `  ${negOk ? "✔" : "✘"} negativo  ${CONTROLE_NEGATIVO} (não injetada) ${negOk ? "ausente" : "PRESENTE — o gate está casando qualquer coisa"}`,
);

console.log("\n=== COBERTURA DO @source ===\n");
const forasDoSource = [];
for (const { pkg, classe } of alvos) {
  const ok = presente(classe);
  if (!ok) {
    falhas++;
    forasDoSource.push(pkg);
  }
  console.log(`  ${ok ? "✔ varrido " : "✘ INVISÍVEL"}  packages/${pkg}  (${classe})`);
}

if (forasDoSource.length) {
  console.error(
    `\n✘ ${forasDoSource.length} pacote(s) fora do @source: ${forasDoSource.join(", ")}\n\n` +
      `  Toda classe Tailwind escrita nesses pacotes é descartada em silêncio:\n` +
      `  o build passa, não há warning, e a tela quebra em produção.\n\n` +
      `  Correção em apps/web/src/app/globals.css:\n` +
      `      @source "../../../../packages";\n\n` +
      `  Cuidado: glob de DIRETÓRIO (packages/<curinga>/src) não casa nada nesta\n` +
      `  versão do Tailwind e derruba 39 KB de CSS sem falhar o build.\n`,
  );
} else if (falhas === 0) {
  console.log(
    `\n✔ os ${PACOTES.length} pacotes estão sob o @source do Tailwind\n`,
  );
}

process.exit(falhas === 0 ? 0 : 1);
