import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { isAuthSessionMissingError, type Session } from "@supabase/supabase-js";
import {
  clearLastNativeAuthUserId,
  clearNativeAccountStorage,
  readPersistedNativeAuthUserId,
  readLastNativeAuthUserId,
  rememberNativeAuthUserId,
} from "../lib/nativeAccountStorage";
import { isNativeConfirmedInvalidSessionError, isNativeTransientAuthError, type NativeAuthStatus } from "../lib/nativeAuthState";
import {
  getNativeNetworkStatus,
  setNativeProtectedRequestsAllowed,
  subscribeToNativeAuthRejection,
  subscribeToNativeNetworkStatus,
} from "../lib/networkStatus";
import { clearNativeSupabaseLocalSession, nativeAuthStorageKey, nativeSupabase } from "../lib/supabase";
import {
  clearNativePushRegistrationForUser,
  registerNativePushTokenForCurrentUser,
  subscribeToNativePushTokenRefresh,
} from "../lib/pushRegistration";

export type NativeAuthSnapshot =
  | { status: "initializing"; session: null; cacheUserId: null; error: null }
  | { status: "authenticated"; session: Session; cacheUserId: string; error: null }
  | { status: "signedOut"; session: null; cacheUserId: null; error: null }
  | { status: "offlineDeferred"; session: null; cacheUserId: string | null; error: Error | null }
  | { status: "invalidSession"; session: null; cacheUserId: string | null; error: Error | null };

export type NativeSignOutResult = { remoteRevocationConfirmed: boolean };

type NativeAuthContextValue = {
  session: Session | null;
  cacheUserId: string | null;
  status: NativeAuthStatus;
  loading: boolean;
  error: Error | null;
  retrySessionValidation: () => Promise<void>;
  signOutNative: () => Promise<NativeSignOutResult>;
};

const NativeAuthContext = createContext<NativeAuthContextValue | undefined>(undefined);
const BOOTSTRAP_TIMEOUT_MS = 15_000;
const INITIAL_AUTH_STATE: NativeAuthSnapshot = {
  status: "initializing",
  session: null,
  cacheUserId: null,
  error: null,
};

export function NativeAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NativeAuthSnapshot>(INITIAL_AUTH_STATE);
  const stateRef = useRef<NativeAuthSnapshot>(INITIAL_AUTH_STATE);
  const authEventVersion = useRef(0);
  const lastKnownUserId = useRef<string | null>(null);
  const explicitLogout = useRef(false);
  const validationPromise = useRef<Promise<void> | null>(null);
  const protectedValidationPromise = useRef<Promise<void> | null>(null);

  const updateState = useCallback((next: NativeAuthSnapshot) => {
    stateRef.current = next;
    setNativeProtectedRequestsAllowed(
      next.status === "authenticated",
      next.status === "offlineDeferred",
    );
    setState(next);
  }, []);

  const acceptSession = useCallback((session: Session, previousUserId = stateRef.current.cacheUserId ?? lastKnownUserId.current) => {
    const nextUserId = session.user.id;
    updateState({ status: "authenticated", session, cacheUserId: nextUserId, error: null });
    lastKnownUserId.current = nextUserId;
    if (previousUserId && previousUserId !== nextUserId) {
      void clearNativeAccountStorage(previousUserId).catch((cause: unknown) => {
        console.warn("Could not clear the previous account's local cache.", cause);
      });
    }
    void rememberNativeAuthUserId(nextUserId).catch((cause: unknown) => {
      console.warn("Could not remember the last signed-in account.", cause);
    }).then(async () => {
      if (stateRef.current.cacheUserId !== nextUserId) await clearLastNativeAuthUserId(nextUserId);
    });
  }, [updateState]);

  const finishLocalSignOut = useCallback(async (userId: string | null) => {
    updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
    if (lastKnownUserId.current === userId) lastKnownUserId.current = null;
    if (!userId) return;
    await clearNativeAccountStorage(userId);
    await clearLastNativeAuthUserId(userId);
  }, [updateState]);

  const resolveSessionResult = useCallback(async (
    result: Awaited<ReturnType<typeof nativeSupabase.auth.getSession>>,
    rememberedUserId: string | null,
  ) => {
    const session = result.data.session;
    if (session) {
      acceptSession(session, rememberedUserId);
      return;
    }

    const error = result.error ?? null;
    if (error && isNativeTransientAuthError(error)) {
      updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error });
      return;
    }
    if (error && isNativeConfirmedInvalidSessionError(error)) {
      await clearNativeSupabaseLocalSession().catch((cause: unknown) => {
        console.warn("Could not clear the server-rejected local session.", cause);
      });
      updateState({ status: "invalidSession", session: null, cacheUserId: rememberedUserId, error });
      return;
    }
    if (error && isAuthSessionMissingError(error)) {
      if (rememberedUserId) {
        await clearLastNativeAuthUserId(rememberedUserId).catch(() => undefined);
      }
      updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
      return;
    }

    if (error && rememberedUserId) {
      updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error });
      return;
    }
    if (rememberedUserId) await clearLastNativeAuthUserId(rememberedUserId).catch(() => undefined);
    updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
  }, [acceptSession, updateState]);

  const retrySessionValidation = useCallback(async () => {
    if (validationPromise.current) return validationPromise.current;
    if (stateRef.current.status !== "offlineDeferred" && stateRef.current.status !== "initializing") return;
    if (getNativeNetworkStatus().isOffline) return;

    const rememberedUserId = stateRef.current.cacheUserId ?? lastKnownUserId.current;
    const attemptVersion = authEventVersion.current;
    const request = (async () => {
      try {
        const result = await nativeSupabase.auth.getSession();
        if (attemptVersion !== authEventVersion.current) return;
        await resolveSessionResult(result, rememberedUserId);
      } catch (cause) {
        if (attemptVersion !== authEventVersion.current) return;
        if (isNativeTransientAuthError(cause)) {
          updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error: cause });
        } else if (isNativeConfirmedInvalidSessionError(cause)) {
          await clearNativeSupabaseLocalSession().catch(() => undefined);
          updateState({ status: "invalidSession", session: null, cacheUserId: rememberedUserId, error: cause instanceof Error ? cause : null });
        } else if (isAuthSessionMissingError(cause)) {
          updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
        } else {
          updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error: cause instanceof Error ? cause : null });
        }
      }
    })();
    validationPromise.current = request;
    try {
      await request;
    } finally {
      if (validationPromise.current === request) validationPromise.current = null;
    }
  }, [resolveSessionResult, updateState]);

  const validateProtectedAuth = useCallback(() => {
    if (protectedValidationPromise.current) return protectedValidationPromise.current;
    const current = stateRef.current;
    if (current.status !== "authenticated") return Promise.resolve();
    const userId = current.session.user.id;
    const attemptVersion = authEventVersion.current;
    const request = (async () => {
      try {
        const { data, error } = await nativeSupabase.auth.getUser(current.session.access_token);
        if (attemptVersion !== authEventVersion.current) return;
        if (!error && data.user?.id === userId) return;
        if (error && isNativeTransientAuthError(error)) {
          lastKnownUserId.current = userId;
          updateState({ status: "offlineDeferred", session: null, cacheUserId: userId, error });
          return;
        }
        if (error && !isNativeConfirmedInvalidSessionError(error)) return;
        await clearNativeSupabaseLocalSession().catch((cause: unknown) => {
          console.warn("Could not clear a server-rejected local session.", cause);
        });
        await clearLastNativeAuthUserId(userId).catch(() => undefined);
        updateState({
          status: "invalidSession",
          session: null,
          cacheUserId: userId,
          error: error ?? new Error("This session is no longer valid. Sign in again to continue."),
        });
      } catch (cause) {
        if (attemptVersion !== authEventVersion.current) return;
        if (isNativeTransientAuthError(cause)) {
          lastKnownUserId.current = userId;
          updateState({ status: "offlineDeferred", session: null, cacheUserId: userId, error: cause });
        }
      }
    })();
    protectedValidationPromise.current = request;
    return request.finally(() => {
      if (protectedValidationPromise.current === request) protectedValidationPromise.current = null;
    });
  }, [updateState]);

  const signOutNative = useCallback(async (): Promise<NativeSignOutResult> => {
    const userId = stateRef.current.cacheUserId;
    const hadUsableSession = stateRef.current.status === "authenticated" && stateRef.current.session !== null;
    explicitLogout.current = true;
    try {
      await clearNativePushRegistrationForUser(userId ?? "");
      const { error } = await nativeSupabase.auth.signOut({ scope: "global" });
      if (!error) {
        await finishLocalSignOut(userId);
        return { remoteRevocationConfirmed: hadUsableSession };
      }
      if (isNativeTransientAuthError(error)) {
        await clearNativeSupabaseLocalSession();
        await finishLocalSignOut(userId);
        return { remoteRevocationConfirmed: false };
      }
      if (stateRef.current.status === "signedOut") {
        await finishLocalSignOut(userId);
        return { remoteRevocationConfirmed: false };
      }
      throw error;
    } finally {
      explicitLogout.current = false;
    }
  }, [finishLocalSignOut]);

  useEffect(() => {
    if (state.status !== "authenticated") return;
    const userId = state.session.user.id;
    void registerNativePushTokenForCurrentUser(userId);
    const tokenSubscription = subscribeToNativePushTokenRefresh(userId);
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void registerNativePushTokenForCurrentUser(userId);
    });
    return () => {
      tokenSubscription.remove();
      appStateSubscription.remove();
    };
  }, [state]);

  useEffect(() => {
    let active = true;
    let unsubscribeAuth: () => void = () => {};
    let unsubscribeNetwork: () => void = () => {};
    let unsubscribeAuthRejection: () => void = () => {};

    let timeout: ReturnType<typeof setTimeout> | null = null;
    void (async () => {
      let rememberedUserId = await readLastNativeAuthUserId().catch(() => null);
      if (!rememberedUserId) {
        rememberedUserId = await readPersistedNativeAuthUserId(nativeAuthStorageKey).catch(() => null);
      }
      if (!active) return;
      lastKnownUserId.current = rememberedUserId;
      const startingEventVersion = authEventVersion.current;
      const { data: { subscription } } = nativeSupabase.auth.onAuthStateChange((event, nextSession) => {
        if (!active || event === "INITIAL_SESSION") return;
        authEventVersion.current += 1;
        if (nextSession) {
          acceptSession(nextSession, stateRef.current.cacheUserId ?? lastKnownUserId.current);
        } else if (event === "SIGNED_OUT") {
          const userId = stateRef.current.cacheUserId ?? lastKnownUserId.current;
          if (explicitLogout.current) {
            void finishLocalSignOut(userId).catch((cause: unknown) => {
              console.warn("Could not clear local account data after sign-out.", cause);
            });
          } else {
            updateState({
              status: "invalidSession",
              session: null,
              cacheUserId: userId,
              error: new Error("Your session is no longer valid. Sign in again to continue."),
            });
          }
        }
      });
      unsubscribeAuth = () => subscription.unsubscribe();
      unsubscribeNetwork = subscribeToNativeNetworkStatus((network) => {
        if (active && network.isKnown && !network.isOffline && stateRef.current.status === "offlineDeferred") {
          void retrySessionValidation();
        }
      });
      unsubscribeAuthRejection = subscribeToNativeAuthRejection(() => {
        void validateProtectedAuth();
      });

      const bootstrapTimeout = new Promise<{ timedOut: true }>((resolve) => {
        timeout = setTimeout(() => resolve({ timedOut: true }), BOOTSTRAP_TIMEOUT_MS);
      });
      const sessionResult = nativeSupabase.auth.getSession()
        .then((result) => ({ timedOut: false as const, result }))
        .catch((error: unknown) => ({ timedOut: false as const, error }));
      const outcome = await Promise.race([sessionResult, bootstrapTimeout]);
      if (!active || startingEventVersion !== authEventVersion.current) return;
      if ("timedOut" in outcome && outcome.timedOut) {
        const network = getNativeNetworkStatus();
        if (rememberedUserId || network.isOffline || !network.isKnown) {
          updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error: null });
        } else {
          updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
        }
        return;
      }
      if ("error" in outcome) {
        const error = outcome.error;
        if (isNativeTransientAuthError(error)) {
          updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error: error instanceof Error ? error : null });
        } else if (isNativeConfirmedInvalidSessionError(error)) {
          await clearNativeSupabaseLocalSession().catch(() => undefined);
          updateState({ status: "invalidSession", session: null, cacheUserId: rememberedUserId, error: error instanceof Error ? error : null });
        } else if (isAuthSessionMissingError(error)) {
          updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
        } else if (rememberedUserId) {
          updateState({ status: "offlineDeferred", session: null, cacheUserId: rememberedUserId, error: error instanceof Error ? error : null });
        } else {
          updateState({ status: "signedOut", session: null, cacheUserId: null, error: null });
        }
        return;
      }
      await resolveSessionResult(outcome.result, rememberedUserId);
    })().catch((cause: unknown) => {
      if (active) {
        updateState({
          status: "offlineDeferred",
          session: null,
          cacheUserId: lastKnownUserId.current,
          error: cause instanceof Error ? cause : null,
        });
      }
    }).finally(() => {
      if (timeout) clearTimeout(timeout);
    });

    return () => {
      active = false;
      unsubscribeAuth();
      unsubscribeNetwork();
      unsubscribeAuthRejection();
      if (timeout) clearTimeout(timeout);
    };
  }, [acceptSession, finishLocalSignOut, resolveSessionResult, retrySessionValidation, updateState, validateProtectedAuth]);

  const value: NativeAuthContextValue = {
    session: state.session,
    cacheUserId: state.cacheUserId,
    status: state.status,
    loading: state.status === "initializing",
    error: state.error,
    retrySessionValidation,
    signOutNative,
  };

  return (
    <NativeAuthContext.Provider value={value}>
      {children}
    </NativeAuthContext.Provider>
  );
}

export function useNativeAuth() {
  const context = useContext(NativeAuthContext);
  if (!context) throw new Error("useNativeAuth must be used within NativeAuthProvider");
  return context;
}