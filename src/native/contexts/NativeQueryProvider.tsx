import { focusManager, onlineManager, QueryClientProvider } from "@tanstack/react-query";
import * as Network from "expo-network";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { nativeQueryClient } from "../lib/queryClient";
import { nativeAccountQueryFilter } from "../lib/queryKeys";
import {
  getNativeNetworkStatus,
  setNativeConnectivityOffline,
  subscribeToNativeNetworkStatus,
} from "../lib/networkStatus";
import { nativeSupabase } from "../lib/supabase";
import { useNativeAuth } from "./NativeAuthProvider";

const NativeConnectivityContext = createContext<{
  isOffline: boolean;
  isConnectivityOffline: boolean;
  hasRequestFailure: boolean;
  isSlow: boolean;
} | null>(null);

export function useNativeConnectivity() {
  const context = useContext(NativeConnectivityContext);
  if (!context) throw new Error("useNativeConnectivity must be used within NativeQueryProvider");
  return context;
}

export function NativeQueryProvider({ children }: { children: ReactNode }) {
  const { cacheUserId, retrySessionValidation, status } = useNativeAuth();
  const userId = cacheUserId;
  const previousUserId = useRef(userId);
  const [isOffline, setIsOffline] = useState(getNativeNetworkStatus().isOffline);
  const [isConnectivityOffline, setIsConnectivityOffline] = useState(getNativeNetworkStatus().isConnectivityOffline);
  const [hasRequestFailure, setHasRequestFailure] = useState(getNativeNetworkStatus().hasRequestFailure);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    let active = true;
    let networkEventsReceived = 0;
    let offlineTimer: ReturnType<typeof setTimeout> | null = null;
    const applyNetworkState = (state: Network.NetworkState) => {
      const isReportedOffline = state.isInternetReachable === false || state.isConnected === false;
      setNativeConnectivityOffline(isReportedOffline, state.isInternetReachable ?? null, state.isConnected ?? null);
    };
    const unsubscribeNetworkStatus = subscribeToNativeNetworkStatus((state) => {
      if (!active) return;
      setIsOffline(state.isOffline);
      setHasRequestFailure(state.hasRequestFailure);
      if (state.hasRequestFailure) {
        if (offlineTimer) clearTimeout(offlineTimer);
        offlineTimer = null;
      } else if (state.isConnectivityOffline) {
        if (!offlineTimer) {
          offlineTimer = setTimeout(() => {
            offlineTimer = null;
            if (active) setIsConnectivityOffline(getNativeNetworkStatus().isConnectivityOffline);
          }, 2000);
        }
      } else {
        if (offlineTimer) clearTimeout(offlineTimer);
        offlineTimer = null;
        setIsConnectivityOffline(false);
      }
    });
    const subscription = Network.addNetworkStateListener((state) => {
      networkEventsReceived += 1;
      applyNetworkState(state);
    });
    void Network.getNetworkStateAsync().then((state) => {
      if (active && networkEventsReceived === 0) applyNetworkState(state);
    }).catch(() => undefined);

    return () => {
      active = false;
      if (offlineTimer) clearTimeout(offlineTimer);
      subscription.remove();
      unsubscribeNetworkStatus();
    };
  }, []);

  useEffect(() => {
    onlineManager.setOnline(!isOffline && status === "authenticated");
  }, [isOffline, status]);

  useEffect(() => {
    if (status === "offlineDeferred" && !isOffline) {
      void retrySessionValidation();
    }
  }, [isOffline, retrySessionValidation, status]);

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
    if (AppState.currentState === "active" && !getNativeNetworkStatus().isOffline && status === "authenticated") nativeSupabase.auth.startAutoRefresh();
    else nativeSupabase.auth.stopAutoRefresh();
    const subscription = AppState.addEventListener("change", (state: AppStateStatus) => {
      const isActive = state === "active";
      focusManager.setFocused(isActive);
      if (isActive && !getNativeNetworkStatus().isOffline && status === "authenticated") {
        nativeSupabase.auth.startAutoRefresh();
      } else {
        nativeSupabase.auth.stopAutoRefresh();
      }
      if (isActive && !getNativeNetworkStatus().isOffline && status === "offlineDeferred") {
        void retrySessionValidation();
      }
    });
    return () => subscription.remove();
  }, [retrySessionValidation, status]);

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
    <NativeConnectivityContext.Provider value={{ isOffline, isConnectivityOffline, hasRequestFailure, isSlow }}>
      <QueryClientProvider client={nativeQueryClient}>
        {children}
      </QueryClientProvider>
    </NativeConnectivityContext.Provider>
  );
}
