import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { nativeQueryClient } from "../lib/queryClient";
import { nativeAccountQueryFilter } from "../lib/queryKeys";
import { useNativeAuth } from "./NativeAuthProvider";

const NativeConnectivityContext = createContext<{ isOffline: boolean; isSlow: boolean } | null>(null);

export function useNativeConnectivity() {
  const context = useContext(NativeConnectivityContext);
  if (!context) throw new Error("useNativeConnectivity must be used within NativeQueryProvider");
  return context;
}

export function NativeQueryProvider({ children }: { children: ReactNode }) {
  const { session } = useNativeAuth();
  const userId = session?.user.id ?? null;
  const previousUserId = useRef(userId);
  const [isOffline, setIsOffline] = useState(false);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    let active = true;
    let networkEventsReceived = 0;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    const applyNetworkState = (state: Network.NetworkState) => {
      const isOnline = state.isInternetReachable ?? state.isConnected ?? true;
      onlineManager.setOnline(isOnline);
      if (offlineTimer) clearTimeout(offlineTimer);
      offlineTimer = null;
      if (isOnline) {
        setIsOffline(false);
      } else {
        offlineTimer = setTimeout(() => {
          if (active) setIsOffline(true);
        }, 2000);
      }
    };
    const subscription = Network.addNetworkStateListener((state) => {
      networkEventsReceived += 1;
      applyNetworkState(state);
    });
    void Network.getNetworkStateAsync().then((state) => {
      if (active && networkEventsReceived === 0) applyNetworkState(state);
    }).catch(() => {
      onlineManager.setOnline(true);
    });

    return () => {
      active = false;
      if (offlineTimer) clearTimeout(offlineTimer);
      subscription.remove();
      onlineManager.setOnline(true);
    };
  }, []);

  useEffect(() => {
    let slowTimer: ReturnType<typeof setTimeout> | null = null;
    const updatePendingState = () => {
      if (nativeQueryClient.isFetching() === 0) {
        if (slowTimer) clearTimeout(slowTimer);
        slowTimer = null;
        setIsSlow(false);
        return;
      }
      if (!slowTimer) {
        slowTimer = setTimeout(() => {
          slowTimer = null;
          setIsSlow(nativeQueryClient.isFetching() > 0);
        }, 8000);
      }
    };
    const unsubscribe = nativeQueryClient.getQueryCache().subscribe(updatePendingState);
    updatePendingState();
    return () => {
      if (slowTimer) clearTimeout(slowTimer);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    focusManager.setFocused(AppState.currentState === "active");
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      focusManager.setFocused(state === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (previousUserId.current === userId) return;
    const previousId = previousUserId.current;
    previousUserId.current = userId;
    if (!previousId) return;

    const previousAccountQueries = nativeAccountQueryFilter(previousId);
    void nativeQueryClient.cancelQueries(previousAccountQueries).then(() => {
      nativeQueryClient.removeQueries(previousAccountQueries);
    });
  }, [userId]);

  return (
    <NativeConnectivityContext.Provider value={{ isOffline, isSlow }}>
      <QueryClientProvider client={nativeQueryClient}>
        {children}
      </QueryClientProvider>
    </NativeConnectivityContext.Provider>
  );
}
