import "server-only";

import { z } from "zod";

import { publicEnv } from "./env.public";

/**
 * Variáveis de ambiente **server-only** — URL interna do Nest e segredo do JWT.
 *
 * O `import "server-only"` acima é a trava: se este módulo for alcançado a
 * partir de um Client Component, o build quebra em vez de embutir `JWT_SECRET`
 * no bundle do browser. Por isso ele NÃO é exportado pelo entry-point do
 * pacote — só por `@recomenda/config/server`.
 */
const serverEnvSchema = z.object({
  /** URL interna do Nest (só server). Usada pelo BFF e pelo proxy `/api/v1`. */
  API_INTERNAL_URL: z.string().url().optional(),
  /** Secret do access JWT — usado pelo proxy de páginas para validar sig/exp. */
  JWT_SECRET: z.string().min(16).optional(),
});

const parsed = serverEnvSchema.safeParse({
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  JWT_SECRET: process.env.JWT_SECRET,
});

if (!parsed.success) {
  throw new Error(`Invalid server environment variables: ${parsed.error.message}`);
}

const data = parsed.data;

function resolveApiInternalUrl(): string {
  if (data.API_INTERNAL_URL) {
    return data.API_INTERNAL_URL.replace(/\/$/, "");
  }
  const publicUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL;
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    return publicUrl.replace(/\/$/, "");
  }
  return "http://localhost:3001/api/v1";
}

export const serverEnv = {
  API_INTERNAL_URL: resolveApiInternalUrl(),
  JWT_SECRET: data.JWT_SECRET,
};
