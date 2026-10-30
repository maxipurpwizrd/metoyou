import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { createNativeEntitlementState, type NativeEntitlementState } from "../lib/entitlement";
import { fetchNativeVibesProEntitlement } from "../lib/profile";
import { nativeEntitlementQueryKey } from "../lib/queryKeys";
import { NATIVE_OFFLINE_MESSAGE } from "../lib/networkStatus";
import { useNativeAuth } from "./NativeAuthProvider";

type NativeEntitlementContextValue = {
  entitlement: NativeEntitlementState;
  refresh: () => Promise<void>;
};

const NativeEntitlementContext = createContext<NativeEntitlementContextValue | null>(null);

export function NativeEntitlementProvider({ children }: { children: ReactNode }) {
  const { session, cacheUserId, loading: authLoading, status } = useNativeAuth();
  const userId = session?.user.id ?? null;
  const cacheOwnerId = cacheUserId;
  const query = useQuery({
    queryKey: nativeEntitlementQueryKey(cacheOwnerId ?? ""),
    queryFn: () => fetchNativeVibesProEntitlement(userId!),
    enabled: Boolean(userId) && !authLoading && status === "authenticated",
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(async () => {
    if (userId) await query.refetch();
  }, [query.refetch, userId]);

  const entitlement = useMemo(
    () => createNativeEntitlementState(
      cacheOwnerId,
      query.data,
      query.isError
        ? query.error ?? new Error("VibesPro access could not be checked.")
        : status === "offlineDeferred" && !query.data
          ? new Error(NATIVE_OFFLINE_MESSAGE)
          : null,
    ),
    [cacheOwnerId, query.data, query.error, query.isError, status],
  );

  const value = useMemo(() => ({ entitlement, refresh }), [entitlement, refresh]);
  return (
    <NativeEntitlementContext.Provider value={value}>
      {children}
    </NativeEntitlementContext.Provider>
  );
}

export function useNativeEntitlement() {
  const context = useContext(NativeEntitlementContext);
  if (!context) throw new Error("useNativeEntitlement must be used within NativeEntitlementProvider");
  return context;
}