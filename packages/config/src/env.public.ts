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
  /**
   * Força o mock do relatório comparativo de safra em `/relatorios`.
   *
   * Tri-estado de propósito — `undefined` NÃO é "desligado": ausente cai para
   * `NODE_ENV === "development"`, que é o comportamento histórico da tela.
   * Quem define decide explicitamente e vale nos dois ambientes.
   */
  NEXT_PUBLIC_REPORTS_MOCK_HARVEST: z.enum(["true", "false"]).optional(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_REPORTS_MOCK_HARVEST: process.env.NEXT_PUBLIC_REPORTS_MOCK_HARVEST,
});

if (!parsed.success) {
  throw new Error(`Invalid public environment variables: ${parsed.error.message}`);
}

export const publicEnv = {
  NEXT_PUBLIC_API_BASE_URL: parsed.data.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_REPORTS_MOCK_HARVEST: parsed.data.NEXT_PUBLIC_REPORTS_MOCK_HARVEST,
};
