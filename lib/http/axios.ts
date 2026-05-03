import axios, { AxiosError } from "axios";
import { env } from "@/config/env";
import { getAccessToken, setAccessToken } from "@/lib/auth/token-store";
import type { ApiError, ApiErrorPayload } from "@/lib/api/types";

type PendingRequest = {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function flushPendingRequests(error?: unknown, token?: string | null) {
  pendingRequests.forEach((request) => {
    if (error) {
      request.reject(error);
      return;
    }

    request.resolve(token ?? null);
  });

  pendingRequests = [];
}

async function refreshAccessToken() {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh session");
  }

  const payload = (await response.json()) as { access_token: string };
  setAccessToken(payload.access_token);
  return payload.access_token;
}

export const api = axios.create({
  baseURL: env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (
    config.method &&
    ["post", "put", "patch", "delete"].includes(config.method.toLowerCase())
  ) {
    config.headers["Idempotency-Key"] = crypto.randomUUID();
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: (token) => {
              if (token && originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const token = await refreshAccessToken();
        flushPendingRequests(undefined, token);
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        setAccessToken(null);
        flushPendingRequests(refreshError, null);
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      } finally {
        isRefreshing = false;
      }
    }

    const typedError = new Error(
      error.response?.data?.error?.message ?? "Unexpected API error",
    ) as ApiError;
    typedError.status = error.response?.status;
    typedError.code = error.response?.data?.error?.code;
    typedError.details = error.response?.data?.error?.details;
    typedError.requestId = error.response?.data?.error?.request_id;

    throw typedError;
  },
);
