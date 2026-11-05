/** AD-17：全專案唯一發請求的地方，統一處理 401 與錯誤格式（AD-16）。 */

import { routes } from "../routes";
import type { components } from "./schema";

export const API_PREFIX = "/api/v1";

/** 請求沒有送達，沒有 HTTP 狀態碼；用 0 才能與伺服器真正回的 503 區分。 */
const NETWORK_ERROR_STATUS = 0;

type ErrorBody = components["schemas"]["ErrorBody"];

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorBody["code"];
  readonly details: ErrorBody["details"];
  readonly fields: ErrorBody["fields"];

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.fields = body.fields;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 領用、報廢必填（AD-8），來自 useIdempotencyKey。 */
  idempotencyKey?: string;
  /** 視為正常回應、不丟 ApiError 的非 2xx 狀態碼，例如 /health 的 503。 */
  acceptStatuses?: readonly number[];
  signal?: AbortSignal;
  /** Auth screens handle a missing/failed session inline. */
  redirectOnUnauthorized?: boolean;
}

function isErrorResponse(value: unknown): value is { error: ErrorBody } {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }
  const error = value.error;
  return typeof error === "object" && error !== null && "code" in error && "message" in error;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

function internalError(status: number, message: string): ApiError {
  return new ApiError(status, { code: "INTERNAL_ERROR", message, details: {}, fields: [] });
}

/** 內容不是 JSON 時回 undefined。 */
async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    return undefined;
  }
}

function redirectToLogin(): void {
  if (window.location.pathname !== routes.login) {
    window.location.assign(routes.login);
  }
}

/** path 是完整路徑；業務 API 請用 `${API_PREFIX}/...`。 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, idempotencyKey, acceptStatuses = [], signal,
    redirectOnUnauthorized = true } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (idempotencyKey !== undefined) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }
    throw internalError(NETWORK_ERROR_STATUS, "無法連線到伺服器，請確認網路後再試");
  }

  if (response.status === 204) {
    return undefined as T;
  }
  const payload = await parseJson(response);

  if (response.ok || acceptStatuses.includes(response.status)) {
    if (payload === undefined) {
      throw internalError(response.status, "伺服器回應格式錯誤，請稍後再試");
    }
    return payload as T;
  }

  if (response.status === 401) {
    if (path !== `${API_PREFIX}/auth/login`) {
      window.dispatchEvent(new Event("foodflow:unauthorized"));
    }
    if (redirectOnUnauthorized) redirectToLogin();
  }
  if (isErrorResponse(payload)) {
    throw new ApiError(response.status, payload.error);
  }
  throw internalError(response.status, "無法連線到伺服器，請稍後再試");
}
