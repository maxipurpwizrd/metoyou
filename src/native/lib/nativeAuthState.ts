import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js";
import { isNativeNetworkRequestError } from "./networkStatus";

export type NativeAuthStatus =
  | "initializing"
  | "authenticated"
  | "signedOut"
  | "offlineDeferred"
  | "invalidSession";

export function isNativeTransientAuthError(cause: unknown) {
  return isAuthRetryableFetchError(cause) || isNativeNetworkRequestError(cause);
}

export function isNativeConfirmedInvalidSessionError(cause: unknown) {
  if (!isAuthApiError(cause)) return false;
  return cause.status === 401 ||
    cause.code === "invalid_grant" ||
    cause.code === "refresh_token_not_found" ||
    cause.code === "session_not_found";
}