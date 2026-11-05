import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../../shared/api/queryKeys";
import { fetchHealth } from "./api";

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health.all,
    queryFn: ({ signal }) => fetchHealth(signal),
    retry: false,
  });
}
