import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import {
  areNativeProtectedRequestsDeferred,
  canMakeNativeProtectedRequest,
  getNativeNetworkStatus,
  isNativeNetworkRequestError,
  NATIVE_OFFLINE_MESSAGE,
  reportNativeAuthRejection,
  reportNativeNetworkRequestFailure,
  reportNativeNetworkRequestSuccess,
} from "./networkStatus";
import { AuthSessionMissingError } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.");
}

const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
const supabaseOrigin = new URL(supabaseUrl).origin;
export const nativeAuthStorageKey = `sb-${projectRef}-auth-token`;
const platformFetch = globalThis.fetch.bind(globalThis);

const networkAwareFetch: typeof fetch = async (input, init) => {
  const requestUrl = typeof input === "string"
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
  const targetUrl = new URL(requestUrl, supabaseOrigin);
  const isAuthRequest = targetUrl.pathname.startsWith("/auth/v1/");
  if (
    targetUrl.origin === supabaseOrigin &&
    !isAuthRequest &&
    !canMakeNativeProtectedRequest()
  ) {
    if (areNativeProtectedRequestsDeferred() && getNativeNetworkStatus().isOffline) {
      const error = new Error(NATIVE_OFFLINE_MESSAGE);
      reportNativeNetworkRequestFailure(error);
      throw error;
    }
    throw new AuthSessionMissingError();
  }
  const requestSignal = init?.signal ?? (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined);
  const controller = new AbortController();
  const timeoutMs = requestUrl.includes("/storage/v1/object/") ? 120_000 : 20_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort(requestSignal?.reason);
  if (requestSignal?.aborted) forwardAbort();
  else requestSignal?.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await platformFetch(input, { ...init, signal: controller.signal });
    if (
      response.status === 401 &&
      targetUrl.origin === supabaseOrigin &&
      !targetUrl.pathname.startsWith("/auth/v1/")
    ) {
      reportNativeAuthRejection();
    }
    reportNativeNetworkRequestSuccess();
    return response;
  } catch (cause) {
    const timedOut = controller.signal.aborted && !requestSignal?.aborted;
    if (timedOut || isNativeNetworkRequestError(cause)) {
      reportNativeNetworkRequestFailure(new Error(NATIVE_OFFLINE_MESSAGE));
      throw new Error(NATIVE_OFFLINE_MESSAGE);
    }
    throw cause;
  } finally {
    clearTimeout(timeout);
    requestSignal?.removeEventListener("abort", forwardAbort);
  }
};

export const nativeSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: networkAwareFetch },
  auth: {
    storage: AsyncStorage,
    storageKey: nativeAuthStorageKey,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export async function clearNativeSupabaseLocalSession() {
  await AsyncStorage.removeItem(nativeAuthStorageKey);
  const { error } = await nativeSupabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}