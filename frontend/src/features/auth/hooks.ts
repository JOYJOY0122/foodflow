import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../../shared/api/queryKeys";
import * as api from "./api";

export type { Employee, EmployeeCreate, EmployeeUpdate, EmployeeFilters } from "./api";

export function useCurrentEmployee() {
  return useQuery({ queryKey: queryKeys.auth.all,
    queryFn: ({ signal }) => api.currentEmployee(signal), retry: false, staleTime: 0 });
}
export function useLogin() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.login, onSuccess: async (employee) => {
    await client.cancelQueries();
    client.clear();
    client.setQueryData(queryKeys.auth.all, employee);
  } });
}
export function useLogout() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.logout, onSuccess: async () => {
    await client.cancelQueries();
    client.clear();
    client.setQueryData(queryKeys.auth.all, null);
  } });
}
export function useEmployees(filters: api.EmployeeFilters, enabled: boolean) {
  return useQuery({ queryKey: queryKeys.employees.list(filters),
    queryFn: ({ signal }) => api.listEmployees(filters, signal), enabled });
}
export function useCreateEmployee() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.createEmployee,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.employees.all }) });
}
export function useUpdateEmployee() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, body }: { id: number; body: api.EmployeeUpdate }) =>
    api.updateEmployee(id, body),
  onSuccess: async (employee) => {
    const current = client.getQueryData<api.Employee>(queryKeys.auth.all);
    if (current?.id === employee.id) {
      // A self-demotion/disable invalidates the session on the server.
      if (!employee.is_active || (current.role === "ADMIN" && employee.role !== "ADMIN")) {
        await client.cancelQueries();
        client.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.auth.all[0] });
        client.setQueryData(queryKeys.auth.all, null);
        return;
      }
      client.setQueryData(queryKeys.auth.all, employee);
    }
    await client.invalidateQueries({ queryKey: queryKeys.employees.all });
  } });
}
export function useResetPassword() {
  const client = useQueryClient();
  return useMutation({ mutationFn: ({ id, password }: { id: number; password: string }) =>
    api.resetPassword(id, password), onSuccess: async (_, { id }) => {
    if (client.getQueryData<api.Employee>(queryKeys.auth.all)?.id === id) {
      await client.cancelQueries();
      client.removeQueries({ predicate: (query) => query.queryKey[0] !== queryKeys.auth.all[0] });
      client.setQueryData(queryKeys.auth.all, null);
    }
  } });
}
