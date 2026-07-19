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
