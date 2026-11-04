import { request } from "../../shared/api/client";
import type { components } from "../../shared/api/schema";

export type Health = components["schemas"]["HealthResponse"];

/** 資料庫不通時後端回 503，內容仍是 Health。 */
export function fetchHealth(signal?: AbortSignal): Promise<Health> {
  return request<Health>("/health", { acceptStatuses: [503], signal });
}
