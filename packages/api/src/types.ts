// Declarados em `lib/http/types` (camada de baixo). Re-exportados aqui para os
// consumidores que já importam deste caminho.
export type { ApiError, ApiErrorPayload } from "./http/types";

export interface Pagination {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface AgronomistMePlanResponse {
  plan: {
    id: string;
    name: string;
    plot_quota: number;
    timing_template_quota: number;
    price_brl_monthly: string;
    is_active?: boolean;
  };
  quota_usage: {
    current: number;
    limit: number;
  };
}

/** @deprecated Use AgronomistMePlanResponse — mantido só se algum consumidor esperar só a fatia de quota. */
export interface PlanQuota {
  current: number;
  limit: number;
}
