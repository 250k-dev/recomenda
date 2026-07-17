import { z } from "zod";

const envSchema = z.object({
  /** URL pública usada pelo browser. Em produção deve ser same-origin `/api/v1`. */
  NEXT_PUBLIC_API_BASE_URL: z.string().default("/api/v1"),
  /** URL interna do Nest (só server). Usada pelo BFF e pelo proxy `/api/v1`. */
  API_INTERNAL_URL: z.string().url().optional(),
  /** Secret do access JWT — usado pelo proxy de páginas para validar sig/exp. */
  JWT_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
  JWT_SECRET: process.env.JWT_SECRET,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables: ${parsed.error.message}`);
}

const data = parsed.data;

function resolveApiInternalUrl(): string {
  if (data.API_INTERNAL_URL) {
    return data.API_INTERNAL_URL.replace(/\/$/, "");
  }
  const publicUrl = data.NEXT_PUBLIC_API_BASE_URL;
  if (publicUrl.startsWith("http://") || publicUrl.startsWith("https://")) {
    return publicUrl.replace(/\/$/, "");
  }
  return "http://localhost:3001/api/v1";
}

export const env = {
  NEXT_PUBLIC_API_BASE_URL: data.NEXT_PUBLIC_API_BASE_URL,
  API_INTERNAL_URL: resolveApiInternalUrl(),
  JWT_SECRET: data.JWT_SECRET,
};
