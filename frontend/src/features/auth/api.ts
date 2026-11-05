import { API_PREFIX, request } from "../../shared/api/client";
import type { components } from "../../shared/api/schema";

export type Employee = components["schemas"]["EmployeeResponse"];
export type EmployeeCreate = components["schemas"]["EmployeeCreate"];
export type EmployeeUpdate = components["schemas"]["EmployeeUpdate"];
export type EmployeeList = components["schemas"]["EmployeeList"];
export interface EmployeeFilters { search: string; role: string; status: string; page: number }

export function currentEmployee(signal?: AbortSignal) {
  return request<Employee>(`${API_PREFIX}/auth/me`, { signal, redirectOnUnauthorized: false });
}
export function login(body: components["schemas"]["LoginRequest"]) {
  return request<Employee>(`${API_PREFIX}/auth/login`, {
    method: "POST", body, redirectOnUnauthorized: false,
  });
}
export function logout() {
  return request<void>(`${API_PREFIX}/auth/logout`, { method: "POST" });
}
export function listEmployees(filters: EmployeeFilters, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(filters.page), page_size: "20" });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("is_active", filters.status);
  return request<EmployeeList>(`${API_PREFIX}/employees?${params}`, { signal });
}
export function createEmployee(body: EmployeeCreate) {
  return request<Employee>(`${API_PREFIX}/employees`, { method: "POST", body });
}
export function updateEmployee(id: number, body: EmployeeUpdate) {
  return request<Employee>(`${API_PREFIX}/employees/${id}`, { method: "PATCH", body });
}
export function resetPassword(id: number, password: string) {
  return request<void>(`${API_PREFIX}/employees/${id}/password`, {
    method: "POST", body: { password },
  });
}
