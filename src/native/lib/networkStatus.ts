export type NativeNetworkStatus = {
  isOffline: boolean;
  isConnectivityOffline: boolean;
  hasRequestFailure: boolean;
  isKnown: boolean;
};

export const NATIVE_OFFLINE_MESSAGE = "Oops, you're not connected to the internet. Try checking your internet connection.";

type NetworkStatusListener = (status: NativeNetworkStatus) => void;
type AuthRejectionListener = () => void;

let connectivityOffline = false;
let hasRequestFailure = false;
let connectivityKnown = false;
let protectedRequestsAllowed = false;
let protectedRequestsDeferred = false;
const listeners = new Set<NetworkStatusListener>();
const authRejectionListeners = new Set<AuthRejectionListener>();

function getStatus(): NativeNetworkStatus {
  return {
    isOffline: connectivityOffline || hasRequestFailure,
    isConnectivityOffline: connectivityOffline,
    hasRequestFailure,
    isKnown: connectivityKnown,
  };
}

function publishStatus() {
  const status = getStatus();
  for (const listener of listeners) listener(status);
}

export function getNativeNetworkStatus() {
  return getStatus();
}

export function subscribeToNativeNetworkStatus(listener: NetworkStatusListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function subscribeToNativeAuthRejection(listener: AuthRejectionListener) {
  authRejectionListeners.add(listener);
  return () => {
    authRejectionListeners.delete(listener);
  };
}

export function reportNativeAuthRejection() {
  for (const listener of authRejectionListeners) listener();
}

export function setNativeProtectedRequestsAllowed(allowed: boolean, deferred = false) {
  protectedRequestsAllowed = allowed;
  protectedRequestsDeferred = !allowed && deferred;
}

export function canMakeNativeProtectedRequest() {
  return protectedRequestsAllowed;
}

export function areNativeProtectedRequestsDeferred() {
  return protectedRequestsDeferred;
}

export function setNativeConnectivityOffline(
  isOffline: boolean,
  internetReachable: boolean | null,
  isConnected: boolean | null = null,
) {
  if (isOffline || internetReachable !== null || isConnected === true) connectivityKnown = true;
  connectivityOffline = isOffline;
  if (internetReachable === true || (!isOffline && isConnected === true)) hasRequestFailure = false;
  publishStatus();
}

export function isNativeNetworkRequestError(cause: unknown): cause is Error {
  if (!(cause instanceof Error) || cause.name === "AbortError") return false;
  if (cause.name === "AuthRetryableFetchError") return true;
  if (cause.message.includes(NATIVE_OFFLINE_MESSAGE)) return true;
  return /network request failed|failed to fetch|network error|connection (?:failed|lost|reset|refused)|timed? out|offline/i.test(cause.message);
}

export function getNativeErrorMessage(cause: unknown, fallback: string) {
  if (isNativeNetworkRequestError(cause)) return NATIVE_OFFLINE_MESSAGE;
  if (cause instanceof Error) return cause.message;
  return fallback;
}

export function reportNativeNetworkRequestFailure(cause: unknown) {
  if (!isNativeNetworkRequestError(cause)) return;
  connectivityKnown = true;
  if (hasRequestFailure) return;
  hasRequestFailure = true;
  publishStatus();
}

export function reportNativeNetworkRequestSuccess() {
  const shouldPublish = !connectivityKnown || hasRequestFailure;
  connectivityKnown = true;
  connectivityOffline = false;
  hasRequestFailure = false;
  if (shouldPublish) publishStatus();
}
