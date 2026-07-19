// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- load-bearing, ver o porquê logo abaixo
/// <reference path="../axios.d.ts" />
// A referência acima é necessária: `axios.d.ts` aumenta `InternalAxiosRequestConfig`
// com `_retry`, mas ninguém o importa. Dentro do pacote o `include` do tsconfig o
// pega; no programa do app, não — e a augmentação sumiria em silêncio.
import axios, { AxiosError } from "axios";
import type { ApiError, ApiErrorPayload } from "./types";

type PendingRequest = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let pendingRequests: PendingRequest[] = [];

function flushPendingRequests(error?: unknown) {
  pendingRequests.forEach((request) => {
    if (error) {
      request.reject(error);
      return;
    }
    request.resolve();
  });
  pendingRequests = [];
}

async function refreshSession() {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh session");
  }
}

async function clearSessionAndRedirect() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  }).catch(() => null);

  if (typeof window !== "undefined") {
    window.location.href = "/login?force=1";
  }
}

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
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
            resolve: () => resolve(api(originalRequest)),
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshSession();
        flushPendingRequests();
        return api(originalRequest);
      } catch (refreshError) {
        flushPendingRequests(refreshError);
        await clearSessionAndRedirect();
        throw refreshError;
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
