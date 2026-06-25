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
