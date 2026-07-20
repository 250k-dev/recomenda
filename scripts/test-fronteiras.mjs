#!/usr/bin/env node
/**
 * Testa as regras de fronteira do `eslint.config.mjs` com violações propositais.
 *
 * Por que isto existe, e por que roda no CI:
 * uma regra de fronteira que não pega nada tem exatamente a mesma aparência de
 * uma que está funcionando — o lint passa nos dois casos. Foi assim que o A8
 * descobriu que `boundaries/dependencies` sozinho era cego para imports
 * `@recomenda/*`: sob pnpm, o pacote alvo só está linkado se for uma dependência
 * declarada, e um import que viola o grafo nunca é declarado. A regra passava
 * em silêncio.
 *
 * Três coisas que este harness faz e que a versão anterior não fazia:
 *
 * 1. **As sondas de grafo são GERADAS a partir do `GRAFO`**, importado do
 *    próprio `eslint.config.mjs`. Antes eram 11 arestas escritas à mão de 29
 *    proibidas — e `api-hooks`, o pacote com o padrão de negação mais complexo,
 *    não era origem de nenhuma. Agora a cobertura é 29/29 por construção e um
 *    pacote novo ganha sondas no dia em que entrar na tabela.
 * 2. **Cada sonda declara QUAL regra espera** e o teste assere isso. Só verificar
 *    "alguma regra disparou" deixava a Camada 2 degradar em silêncio: ela é a
 *    única que pega as sondas de caminho relativo, e sem asserção nominal a
 *    degradação ficava mascarada pela Camada 1.
 * 3. **Cobre `import()` dinâmico.** `no-restricted-imports` não tem visitor para
 *    `ImportExpression` — o `await import("react")` dentro de `domain` passava
 *    nas duas camadas. Quem pega agora é a Camada 1b (`no-restricted-syntax`).
 *
 * Cada sonda é um arquivo escrito dentro de um pacote. Todas são escritas de
 * uma vez, lintadas em UMA invocação do eslint e apagadas — com handler de
 * sinal, porque um Ctrl-C no meio deixava o arquivo no disco e, como ele cai
 * dentro do `include` do tsconfig, `pnpm typecheck` passava a falhar.
 *
 * Casos `legal: true` são controles: provam que a regra não está simplesmente
 * reprovando tudo.
 *
 * Uso: `pnpm test:fronteiras`
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { GRAFO, PROIBIDOS_EXTERNOS } from "../eslint.config.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const PACOTES = Object.keys(GRAFO);
// `app` é nó do grafo mas não é pacote: não tem nome `@recomenda/*`, então a
// única forma de importá-lo de dentro de `packages/` é caminho relativo — que
// é justamente o que só a Camada 2 pega.
const NOS = [...PACOTES, "app"];
const ALVO_NO_APP = "../../../apps/web/src/lib/auth/session-cookies";

const CAMADA_1 = "no-restricted-imports";
const CAMADA_1B = "no-restricted-syntax";
const CAMADA_2 = "boundaries/dependencies";

// -----------------------------------------------------------------------------
// Sondas geradas: as 29 arestas proibidas do grafo, cada uma em duas formas
// (import estático e `import()` dinâmico).
// -----------------------------------------------------------------------------
const ARESTAS_PROIBIDAS = PACOTES.flatMap((origem) =>
  NOS.filter((alvo) => alvo !== origem && !GRAFO[origem].includes(alvo)).map(
    (alvo) => ({ origem, alvo }),
  ),
);

const GERADAS = ARESTAS_PROIBIDAS.flatMap(({ origem, alvo }) => {
  const noApp = alvo === "app";
  const spec = noApp ? ALVO_NO_APP : `@recomenda/${alvo}`;
  return [
    {
      id: `${origem} → ${alvo}`,
      grupo: "grafo",
      pkg: origem,
      // Import de `app` não casa nenhum padrão `@recomenda/*`: só a Camada 2 vê.
      espera: noApp ? CAMADA_2 : CAMADA_1,
      code: `import * as alvo from "${spec}";\nexport const x = alvo;\n`,
    },
    {
      id: `${origem} → ${alvo} (import dinâmico)`,
      grupo: "grafo",
      pkg: origem,
      espera: noApp ? CAMADA_2 : CAMADA_1B,
      code: `export async function x() {\n  return await import("${spec}");\n}\n`,
    },
  ];
});

// -----------------------------------------------------------------------------
// Sondas geradas: módulos externos proibidos por pacote (`domain` sem
// React/Next/React Query, `ui` sem Next).
// -----------------------------------------------------------------------------
const EXEMPLOS_EXTERNOS = {
  domain: ["react", "react-dom", "next/navigation", "@tanstack/react-query"],
  ui: ["next", "next/link", "next/navigation"],
};

const GERADAS_EXTERNAS = Object.keys(PROIBIDOS_EXTERNOS).flatMap((pkg) =>
  (EXEMPLOS_EXTERNOS[pkg] ?? []).flatMap((mod) => [
    {
      id: `${pkg} → ${mod}`,
      grupo: "externos",
      pkg,
      espera: CAMADA_1,
      code: `import * as m from "${mod}";\nexport const x = m;\n`,
    },
    {
      id: `${pkg} → ${mod} (import dinâmico)`,
      grupo: "externos",
      pkg,
      espera: CAMADA_1B,
      code: `export async function x() {\n  return await import("${mod}");\n}\n`,
    },
  ]),
);

// -----------------------------------------------------------------------------
// Sondas à mão: as que NÃO derivam do grafo — formas de import que poderiam
// escapar do padrão, e os controles.
// -----------------------------------------------------------------------------
const MANUAIS = [
  // ---- Formas de import ----
  {
    id: "import profundo (@recomenda/ui/popover)",
    pkg: "domain",
    espera: CAMADA_1,
    code: `import { Popover } from "@recomenda/ui/popover";\nexport const x = Popover;\n`,
  },
  {
    id: "import profundo 2 níveis (@recomenda/api/http/types)",
    pkg: "utils",
    espera: CAMADA_1,
    code: `import type { ApiError } from "@recomenda/api/http/types";\nexport type X = ApiError;\n`,
  },
  {
    id: "import dinâmico profundo (@recomenda/api/farms)",
    pkg: "ui",
    espera: CAMADA_1B,
    code: `export async function x() {\n  return await import("@recomenda/api/farms");\n}\n`,
  },
  {
    id: "export ... from",
    pkg: "ui",
    espera: CAMADA_1,
    code: `export { farmsApi } from "@recomenda/api";\n`,
  },
  {
    id: "export * from",
    pkg: "ui",
    espera: CAMADA_1,
    code: `export * from "@recomenda/api";\n`,
  },
  {
    id: "import type-only",
    pkg: "ui",
    espera: CAMADA_1,
    code: `import type * as a from "@recomenda/api";\nexport type X = typeof a;\n`,
  },
  {
    id: "import = require()",
    pkg: "ui",
    espera: CAMADA_1,
    code: `import a = require("@recomenda/api");\nexport const x = a;\n`,
  },

  // ---- Escape por caminho relativo: não casa nenhum padrão `@recomenda/*`,
  //      então SÓ a Camada 2 pega. São as duas sondas que provam que ela não
  //      degradou — e a razão de o harness asserir a regra pelo nome.
  {
    id: "ui → api por caminho relativo",
    pkg: "ui",
    espera: CAMADA_2,
    code: `import * as a from "../../api/src/index";\nexport const x = a;\n`,
  },
  {
    id: "ui → api por caminho relativo (import dinâmico)",
    pkg: "ui",
    espera: CAMADA_2,
    code: `export async function x() {\n  return await import("../../api/src/index");\n}\n`,
  },

  // ---- CONTROLES: imports legítimos, não podem falhar ----
  {
    id: "CONTROLE ui → utils",
    pkg: "ui",
    legal: true,
    code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n`,
  },
  {
    id: "CONTROLE ui → utils (import dinâmico)",
    pkg: "ui",
    legal: true,
    code: `export async function x() {\n  return await import("@recomenda/utils");\n}\n`,
  },
  {
    id: "CONTROLE ui → react",
    pkg: "ui",
    legal: true,
    code: `import { useState } from "react";\nexport const x = useState;\n`,
  },
  {
    id: "CONTROLE ui → react (import dinâmico)",
    pkg: "ui",
    legal: true,
    code: `export async function x() {\n  return await import("react");\n}\n`,
  },
  {
    id: "CONTROLE domain → api",
    pkg: "domain",
    legal: true,
    code: `import * as a from "@recomenda/api";\nexport const x = a;\n`,
  },
  {
    id: "CONTROLE domain → api (import dinâmico)",
    pkg: "domain",
    legal: true,
    code: `export async function x() {\n  return await import("@recomenda/api");\n}\n`,
  },
  {
    id: "CONTROLE domain → utils",
    pkg: "domain",
    legal: true,
    code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n`,
  },
  {
    id: "CONTROLE api → utils",
    pkg: "api",
    legal: true,
    code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n`,
  },
  {
    id: "CONTROLE api-hooks → domain",
    pkg: "api-hooks",
    legal: true,
    code: `import * as d from "@recomenda/domain";\nexport const x = d;\n`,
  },
  {
    id: "CONTROLE api-hooks → react",
    pkg: "api-hooks",
    legal: true,
    code: `import { useState } from "react";\nexport const x = useState;\n`,
  },
  // `@recomenda/tsconfig` é reaberto na negação de propósito: negá-lo daria
  // erro confuso a quem tentasse importar. O controle guarda essa exceção.
  {
    id: "CONTROLE utils → @recomenda/tsconfig",
    pkg: "utils",
    legal: true,
    code: `export const x = "@recomenda/tsconfig";\n`,
  },
];

const CASES = [...GERADAS, ...GERADAS_EXTERNAS, ...MANUAIS.map((c) => ({ grupo: "manuais", ...c }))];

// As três camadas de enforcement da config da raiz.
const REGRAS_DE_FRONTEIRA = new Set([CAMADA_1, CAMADA_1B, CAMADA_2]);

// -----------------------------------------------------------------------------
// Escrita, lint e limpeza
// -----------------------------------------------------------------------------
const escritos = new Set();

function limpar() {
  for (const p of escritos) rmSync(p, { force: true });
  escritos.clear();
}

/**
 * Varre e apaga sonda de execução anterior antes de começar.
 * Os handlers de sinal abaixo cobrem Ctrl-C, mas não cobrem SIGKILL nem queda
 * de energia — e uma sonda esquecida cai dentro do `include` do tsconfig do
 * pacote, o que faz `pnpm typecheck` falhar num arquivo que ninguém escreveu.
 * Esta varredura fecha o caso independente de sinal.
 */
function limparOrfas() {
  const orfas = PACOTES.map((pkg) => path.join(ROOT, "packages", pkg, "src"))
    .flatMap((dir) =>
      readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.startsWith("__fronteira_probe"))
        .map((d) => path.join(dir, d.name)),
    );
  for (const p of orfas) rmSync(p, { force: true });
  if (orfas.length) {
    console.log(
      `  (${orfas.length} sonda(s) órfã(s) de execução anterior apagada(s))`,
    );
  }
}

// Sem isto, um Ctrl-C entre o writeFileSync e o fim deixa
// `packages/<pkg>/src/__fronteira_probe_N__.ts` no disco. Como o arquivo cai
// dentro do `include` do tsconfig do pacote, `pnpm typecheck` passa a falhar
// até alguém achar o órfão.
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

const arquivos = CASES.map((c, i) => {
  const p = path.join(
    ROOT,
    "packages",
    c.pkg,
    "src",
    `__fronteira_probe_${i}__.ts`,
  );
  writeFileSync(p, c.code);
  escritos.add(p);
  return p;
});

function lintar(alvos) {
  const rodar = () =>
    execFileSync("npx", ["eslint", "--no-warn-ignored", "-f", "json", ...alvos], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });
  let out;
  try {
    out = rodar();
  } catch (e) {
    // exit != 0 é o caso NORMAL aqui: quase toda sonda é uma violação.
    out = e.stdout || "";
  }
  const i = out.indexOf("[{");
  if (i < 0) {
    limpar();
    console.error("✘ eslint não devolveu JSON. Saída:\n" + out.slice(0, 2000));
    process.exit(1);
  }
  return JSON.parse(out.slice(i));
}

const porArquivo = new Map(
  lintar(arquivos).map((r) => [path.resolve(r.filePath), r.messages]),
);

const resultados = CASES.map((c, i) => {
  const messages = porArquivo.get(path.resolve(arquivos[i])) ?? [];
  // ruleId null com severity 2 é erro de parse — a sonda não chegou a ser
  // avaliada, e contá-la como "não pegou" ou "pegou" mentiria nas duas direções.
  const quebrada = messages.find((m) => m.ruleId === null && m.severity === 2);
  const hits = messages.filter(
    (m) => REGRAS_DE_FRONTEIRA.has(m.ruleId) && m.severity === 2,
  );
  return { ...c, hits, quebrada };
});

limpar();

// -----------------------------------------------------------------------------
// Relatório
// -----------------------------------------------------------------------------
let falhas = 0;

function reportar(titulo, casos) {
  if (casos.length === 0) return;
  console.log(`\n=== ${titulo} ===\n`);
  for (const r of casos) {
    let ok;
    let nota = "";
    if (r.quebrada) {
      ok = false;
      nota = `  ← sonda não compila: ${r.quebrada.message.slice(0, 80)}`;
    } else if (r.legal) {
      ok = r.hits.length === 0;
      if (!ok) nota = `  ← disparou ${r.hits.map((h) => h.ruleId).join(", ")}`;
    } else {
      ok = r.hits.some((h) => h.ruleId === r.espera);
      if (!ok) {
        nota = r.hits.length
          ? `  ← esperava ${r.espera}, veio ${[...new Set(r.hits.map((h) => h.ruleId))].join(", ")}`
          : `  ← esperava ${r.espera}, não veio nada`;
      }
    }
    if (!ok) falhas++;
    const marca = ok ? (r.legal ? "✔ ok    " : "✔ pegou ") : "✘ FALHOU";
    console.log(`  ${marca}  ${r.id}${nota}`);
  }
}

const violacoes = resultados.filter((r) => !r.legal);
const controles = resultados.filter((r) => r.legal);

reportar(
  `GRAFO — ${ARESTAS_PROIBIDAS.length} arestas proibidas × 2 formas (geradas do GRAFO)`,
  resultados.filter((r) => r.grupo === "grafo"),
);
reportar(
  "MÓDULOS EXTERNOS PROIBIDOS (gerados de PROIBIDOS_EXTERNOS)",
  resultados.filter((r) => r.grupo === "externos"),
);
reportar(
  "FORMAS DE IMPORT E CAMINHO RELATIVO (à mão)",
  resultados.filter((r) => r.grupo === "manuais" && !r.legal),
);
reportar("CONTROLES (não podem reprovar)", controles);

// Cobertura: o número de arestas sondadas tem que ser o número de arestas
// proibidas pelo GRAFO. Se alguém mexer no gerador e a conta cair, isto acusa.
const arestasSondadas = new Set(
  GERADAS.map((c) => c.id.replace(" (import dinâmico)", "")),
);
const esperado = ARESTAS_PROIBIDAS.length;
if (arestasSondadas.size !== esperado) {
  falhas++;
  console.error(
    `\n✘ cobertura de grafo: ${arestasSondadas.size} arestas sondadas, ${esperado} proibidas pelo GRAFO.`,
  );
}

console.log(
  `\ncobertura: ${arestasSondadas.size}/${esperado} arestas proibidas do GRAFO, ` +
    `${violacoes.length} sondas de violação, ${controles.length} controles.`,
);

if (falhas === 0) {
  console.log(`\n✔ ${resultados.length} sondas de fronteira OK\n`);
} else {
  console.error(
    `\n✘ ${falhas} de ${total} sondas com resultado errado.\n` +
      `  Uma violação que "PASSOU" significa que a regra correspondente em\n` +
      `  eslint.config.mjs deixou de proteger o grafo — a tabela GRAFO no topo\n` +
      `  dele e a do AGENTS.md ("O que pode importar o quê") são a referência.\n`,
  );
}
process.exit(falhas === 0 ? 0 : 1);
