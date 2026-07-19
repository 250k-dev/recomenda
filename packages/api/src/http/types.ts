/**
 * Contrato de erro do transporte HTTP. Vive aqui — e não em `lib/api` — porque
 * `http` é a camada de baixo: o interceptor do axios precisa desses tipos, e a
 * camada de cima não pode ser pré-requisito da de baixo.
 */
export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
}
