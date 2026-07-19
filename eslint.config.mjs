import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
    // Mockups de design versionados fora do git (`.gitignore:43`). Não são
    // código-fonte do app; sozinhos respondiam por 14 dos 36 achados quando o
    // lint passou a varrer a raiz.
    "docs/design-refactor/**",
  ]),
]);

export default eslintConfig;
