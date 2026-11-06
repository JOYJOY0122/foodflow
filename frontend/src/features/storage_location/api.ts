import { API_PREFIX, request } from "../../shared/api/client";
import type { components } from "../../shared/api/schema";

export type StorageLocation = components["schemas"]["StorageLocationResponse"];
export type StorageLocationCreate = components["schemas"]["StorageLocationCreate"];
export type StorageLocationUpdate = components["schemas"]["StorageLocationUpdate"];
export type StorageLocationList = components["schemas"]["StorageLocationList"];
export interface StorageLocationFilters {
  search: string;
  storageType: string;
  status: string;
  page: number;
}

export const PAGE_SIZE = 20;
const BASE = `${API_PREFIX}/storage-locations`;

export function listStorageLocations(filters: StorageLocationFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), page_size: String(PAGE_SIZE) });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.storageType) params.set("storage_type", filters.storageType);
  if (filters.status) params.set("is_active", filters.status);
  return request<StorageLocationList>(`${BASE}?${params}`, { signal });
}
export function createStorageLocation(body: StorageLocationCreate) {
  return request<StorageLocation>(BASE, { method: "POST", body });
}
export function updateStorageLocation(id: number, body: StorageLocationUpdate) {
  return request<StorageLocation>(`${BASE}/${id}`, { method: "PATCH", body });
}
export function deleteStorageLocation(id: number) {
  return request<void>(`${BASE}/${id}`, { method: "DELETE" });
}
