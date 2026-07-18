import { z } from "zod";

/**
 * Variáveis de ambiente **públicas** — seguras em qualquer lugar, inclusive
 * dentro de um Client Component. Só `NEXT_PUBLIC_*` pode entrar aqui.
 *
 * Segredos e URLs internas ficam em `env.server.ts`, que é alcançável apenas
 * pelo subcaminho `@recomenda/config/server`.
 */
const publicEnvSchema = z.object({
  /** URL pública usada pelo browser. Em produção deve ser same-origin `/api/v1`. */
  NEXT_PUBLIC_API_BASE_URL: z.string().default("/api/v1"),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid public environment variables: ${parsed.error.message}`);
}

export const publicEnv = {
  NEXT_PUBLIC_API_BASE_URL: parsed.data.NEXT_PUBLIC_API_BASE_URL,
};
