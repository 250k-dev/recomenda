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
 * Cada sonda escreve um arquivo dentro de um pacote, roda o eslint só nele e
 * apaga. Casos `legal: true` são controles: provam que a regra não está
 * simplesmente reprovando tudo.
 *
 * Uso: `pnpm test:fronteiras`
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const CASES = [
  // ---- Grafo de dependências: setas proibidas ----
  { id: "ui → api", pkg: "ui", code: `import { farmsApi } from "@recomenda/api";\nexport const x = farmsApi;\n` },
  { id: "ui → domain", pkg: "ui", code: `import * as d from "@recomenda/domain";\nexport const x = d;\n` },
  { id: "ui → api-hooks", pkg: "ui", code: `import * as h from "@recomenda/api-hooks";\nexport const x = h;\n` },
  { id: "utils → api", pkg: "utils", code: `import * as a from "@recomenda/api";\nexport const x = a;\n` },
  { id: "utils → ui", pkg: "utils", code: `import * as u from "@recomenda/ui";\nexport const x = u;\n` },
  { id: "config → utils", pkg: "config", code: `import * as u from "@recomenda/utils";\nexport const x = u;\n` },
  { id: "api → domain (seta invertida)", pkg: "api", code: `import * as d from "@recomenda/domain";\nexport const x = d;\n` },
  { id: "api → api-hooks (seta invertida)", pkg: "api", code: `import * as h from "@recomenda/api-hooks";\nexport const x = h;\n` },
  { id: "domain → api-hooks (seta invertida)", pkg: "domain", code: `import * as h from "@recomenda/api-hooks";\nexport const x = h;\n` },
  { id: "domain → ui", pkg: "domain", code: `import * as u from "@recomenda/ui";\nexport const x = u;\n` },

  // ---- Formas de import que poderiam escapar do padrão ----
  { id: "import profundo (@recomenda/ui/popover)", pkg: "domain", code: `import { Popover } from "@recomenda/ui/popover";\nexport const x = Popover;\n` },
  { id: "import profundo 2 níveis (@recomenda/api/http/types)", pkg: "utils", code: `import type { ApiError } from "@recomenda/api/http/types";\nexport type X = ApiError;\n` },
  { id: "export ... from", pkg: "ui", code: `export { farmsApi } from "@recomenda/api";\n` },
  { id: "import type-only", pkg: "ui", code: `import type * as a from "@recomenda/api";\nexport type X = typeof a;\n` },

  // ---- Escape por caminho relativo (não casa nenhum padrão @recomenda/*) ----
  { id: "ui → api por caminho relativo", pkg: "ui", code: `import * as a from "../../api/src/index";\nexport const x = a;\n` },
  { id: "packages → apps/web por caminho relativo", pkg: "domain", code: `import * as s from "../../../apps/web/src/lib/auth/session-cookies";\nexport const x = s;\n` },

  // ---- `domain` é lógica pura: sem React, Next ou React Query ----
  { id: "domain → react", pkg: "domain", code: `import { useState } from "react";\nexport const x = useState;\n` },
  { id: "domain → react-dom", pkg: "domain", code: `import * as rd from "react-dom";\nexport const x = rd;\n` },
  { id: "domain → next/navigation", pkg: "domain", code: `import { redirect } from "next/navigation";\nexport const x = redirect;\n` },
  { id: "domain → @tanstack/react-query", pkg: "domain", code: `import { useQuery } from "@tanstack/react-query";\nexport const x = useQuery;\n` },

  // ---- `ui` sem Next (armadilha do typedRoutes) ----
  { id: "ui → next/link", pkg: "ui", code: `import Link from "next/link";\nexport const x = Link;\n` },
  { id: "ui → next/navigation", pkg: "ui", code: `import { useRouter } from "next/navigation";\nexport const x = useRouter;\n` },

  // ---- CONTROLES: imports legítimos, não podem falhar ----
  { id: "CONTROLE ui → utils", pkg: "ui", legal: true, code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n` },
  { id: "CONTROLE ui → react", pkg: "ui", legal: true, code: `import { useState } from "react";\nexport const x = useState;\n` },
  { id: "CONTROLE domain → api", pkg: "domain", legal: true, code: `import * as a from "@recomenda/api";\nexport const x = a;\n` },
  { id: "CONTROLE domain → utils", pkg: "domain", legal: true, code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n` },
  { id: "CONTROLE api → utils", pkg: "api", legal: true, code: `import { cn } from "@recomenda/utils";\nexport const x = cn;\n` },
  { id: "CONTROLE api-hooks → domain", pkg: "api-hooks", legal: true, code: `import * as d from "@recomenda/domain";\nexport const x = d;\n` },
  { id: "CONTROLE api-hooks → react", pkg: "api-hooks", legal: true, code: `import { useState } from "react";\nexport const x = useState;\n` },
];

// As duas camadas de enforcement da config da raiz.
const REGRAS_DE_FRONTEIRA = new Set([
  "boundaries/dependencies",
  "no-restricted-imports",
]);

function lintar(arquivo) {
  try {
    const out = execFileSync(
      "npx",
      ["eslint", "--no-warn-ignored", "-f", "json", arquivo],
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(out.slice(out.indexOf("[{")))[0].messages;
  } catch (e) {
    const out = e.stdout || "";
    const i = out.indexOf("[{");
    if (i >= 0) return JSON.parse(out.slice(i))[0].messages;
    return [{ ruleId: "CRASH", severity: 2, message: String(e).slice(0, 300) }];
  }
}

const resultados = CASES.map((c) => {
  const sonda = path.join(ROOT, "packages", c.pkg, "src", "__fronteira_probe__.ts");
  writeFileSync(sonda, c.code);
  try {
    const messages = lintar(sonda);
    const hits = messages.filter(
      (m) => REGRAS_DE_FRONTEIRA.has(m.ruleId) && m.severity === 2,
    );
    return { ...c, hits };
  } finally {
    rmSync(sonda, { force: true });
  }
});

let falhas = 0;

console.log("\n=== VIOLAÇÕES (têm que reprovar o lint) ===\n");
for (const r of resultados.filter((r) => !r.legal)) {
  const ok = r.hits.length > 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? "✔ pegou " : "✘ PASSOU"}  ${r.id}`);
}

console.log("\n=== CONTROLES (não podem reprovar) ===\n");
for (const r of resultados.filter((r) => r.legal)) {
  const ok = r.hits.length === 0;
  if (!ok) falhas++;
  console.log(`  ${ok ? "✔ ok    " : "✘ FALSO+"}  ${r.id}`);
}

const total = resultados.length;
if (falhas === 0) {
  console.log(`\n✔ ${total} sondas de fronteira OK\n`);
} else {
  console.error(
    `\n✘ ${falhas} de ${total} sondas com resultado errado.\n` +
      `  Uma violação que "PASSOU" significa que a regra correspondente em\n` +
      `  eslint.config.mjs deixou de proteger o grafo. Ver docs/monorepo/handoff/A8.md.\n`,
  );
}
process.exit(falhas === 0 ? 0 : 1);
