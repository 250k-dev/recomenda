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

export interface PlanQuota {
  current: number;
  limit: number;
}
