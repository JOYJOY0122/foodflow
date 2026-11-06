import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import { invalidateStockQueries, queryKeys } from "../../shared/api/queryKeys";
import * as api from "./api";

export type {
  StorageLocation, StorageLocationCreate, StorageLocationFilters, StorageLocationUpdate,
} from "./api";
export { PAGE_SIZE } from "./api";

/** 位置的代碼、名稱與啟用狀態會出現在庫存、預警與進貨畫面，所以一併失效（AD-18）。 */
async function invalidateLocations(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.storageLocations.all }),
    invalidateStockQueries(client),
  ]);
}

export function useStorageLocations(filters: api.StorageLocationFilters) {
  return useQuery({ queryKey: queryKeys.storageLocations.list(filters),
    queryFn: ({ signal }) => api.listStorageLocations(filters, signal) });
}
export function useCreateStorageLocation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.createStorageLocation,
    onSuccess: () => invalidateLocations(client) });
}
export function useUpdateStorageLocation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: api.StorageLocationUpdate }) =>
      api.updateStorageLocation(id, body),
    onSuccess: () => invalidateLocations(client),
  });
}
export function useDeleteStorageLocation() {
  const client = useQueryClient();
  return useMutation({ mutationFn: api.deleteStorageLocation,
    onSuccess: () => invalidateLocations(client) });
}
