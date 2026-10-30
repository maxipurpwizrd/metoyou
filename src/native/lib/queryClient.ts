import { QueryClient } from "@tanstack/react-query";
import { isNativeNetworkRequestError } from "./networkStatus";

export const nativeQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => !isNativeNetworkRequestError(error) && failureCount < 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    },
  },
});
