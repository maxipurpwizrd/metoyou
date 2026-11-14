import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { DevicePushToken } from 'expo-notifications';
import { nativeSupabase } from './supabase';

const INSTALLATION_ID_KEY = 'metoyou.native-push-installation-id';
const PUSH_TOKEN_KEY = 'metoyou.native-push-token';
const SAFE_PUSH_ERROR_NAMES = new Set([
  'AbortError',
  'AuthSessionMissingError',
  'CodedError',
  'Error',
  'FunctionsFetchError',
  'FunctionsHttpError',
  'FunctionsRelayError',
  'NetworkError',
  'TypeError',
]);
const SAFE_PUSH_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ERR_CANCELED',
  'ERR_NETWORK',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

export const NATIVE_PUSH_REGISTRATION_STAGES = [
  { key: 'permission', label: 'Permission' },
  { key: 'projectId', label: 'EAS project ID' },
  { key: 'expoToken', label: 'Expo push token' },
  { key: 'prepare', label: 'Device prepare' },
  { key: 'register', label: 'Device register' },
  { key: 'tokenRefresh', label: 'Token refresh' },
  { key: 'logoutRevocation', label: 'Logout revocation' },
] as const;

export type NativePushRegistrationStage = (typeof NATIVE_PUSH_REGISTRATION_STAGES)[number]['key'];
export type NativePushRegistrationTrigger = 'session' | 'foreground' | 'token-refresh';
type NativePushStageResult = {
  result: 'pending' | 'success' | 'failed' | 'skipped';
  detail: string;
};

export type NativePushRegistrationStatus = {
  state: 'checking' | 'registered' | 'permission-denied' | 'unsupported' | 'failed';
  detail: string;
  stages: Partial<Record<NativePushRegistrationStage, NativePushStageResult>>;
};

const initialRegistrationStatus: NativePushRegistrationStatus = {
  state: 'checking',
  detail: "Waiting to check this device's push registration.",
  stages: {},
};
let registrationStatus = initialRegistrationStatus;
const registrationStatusListeners = new Set<(status: NativePushRegistrationStatus) => void>();
type RegistrationRequest = {
  userId: string;
  generation: number;
  trigger: NativePushRegistrationTrigger;
  devicePushToken?: DevicePushToken;
};
type RegistrationFailure = {
  failures: number;
  retryAt: number;
  deviceTokenIdentity: string | null;
};
let currentIdentity = { userId: null as string | null, generation: 0 };
let knownInstallationId: string | null = null;
let registrationDrain: Promise<boolean> | null = null;
let pendingRegistration: RegistrationRequest | null = null;
let installationOperationTail: Promise<void> = Promise.resolve();
const registeredTokens = new Set<string>();
const registrationFailures = new Map<string, RegistrationFailure>();

export function setNativePushRegistrationIdentity(userId: string | null): void {
  const nextUserId = userId || null;
  if (currentIdentity.userId === nextUserId) return;
  currentIdentity = { userId: nextUserId, generation: currentIdentity.generation + 1 };
  registeredTokens.clear();
  if (pendingRegistration && pendingRegistration.userId !== nextUserId) {
    pendingRegistration = null;
  }
}

function isCurrentIdentity(userId: string, generation: number): boolean {
  return currentIdentity.userId === userId && currentIdentity.generation === generation;
}

function enqueueInstallationOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = installationOperationTail.then(operation);
  installationOperationTail = result.then(() => undefined, () => undefined);
  return result;
}

function registrationCacheKey(installationId: string, userId: string, token: string): string {
  return JSON.stringify([installationId, userId, token]);
}

function clearRegisteredTokensForOwner(installationId: string, userId: string): void {
  const prefix = `${JSON.stringify([installationId, userId]).slice(0, -1)},`;
  for (const key of registeredTokens) {
    if (key.startsWith(prefix)) registeredTokens.delete(key);
  }
}

function registrationOwnerKey(installationId: string, userId: string): string {
  return JSON.stringify([installationId, userId]);
}

function getDeviceTokenIdentity(devicePushToken?: DevicePushToken): string | null {
  return devicePushToken ? JSON.stringify([devicePushToken.type, devicePushToken.data]) : null;
}

function reconcileInstallationId(installationId: string): void {
  if (knownInstallationId === installationId) return;
  knownInstallationId = installationId;
  registeredTokens.clear();
  registrationFailures.clear();
}

function getRetryDelay(installationId: string, userId: string, devicePushToken?: DevicePushToken): number {
  const failure = registrationFailures.get(registrationOwnerKey(installationId, userId));
  if (!failure || failure.retryAt <= Date.now()) return 0;
  if (getDeviceTokenIdentity(devicePushToken) !== failure.deviceTokenIdentity) return 0;
  return failure.retryAt - Date.now();
}

function recordRegistrationFailure(
  installationId: string,
  userId: string,
  devicePushToken?: DevicePushToken,
): void {
  const key = registrationOwnerKey(installationId, userId);
  const deviceTokenIdentity = getDeviceTokenIdentity(devicePushToken);
  const previous = registrationFailures.get(key);
  const failures = previous?.deviceTokenIdentity === deviceTokenIdentity
    ? Math.min(7, previous.failures + 1)
    : 1;
  const delay = Math.min(60_000, 1_000 * 2 ** (failures - 1));
  registrationFailures.set(key, { failures, retryAt: Date.now() + delay, deviceTokenIdentity });
}

function updateRegistrationStatus(status: NativePushRegistrationStatus) {
  registrationStatus = status;
  for (const listener of registrationStatusListeners) listener(status);
}

function updateStageResult(
  stage: NativePushRegistrationStage,
  result: NativePushStageResult['result'],
  detail: string,
) {
  const stages = { ...registrationStatus.stages, [stage]: { result, detail } };
  updateRegistrationStatus({ ...registrationStatus, detail, stages });
  console.info(`[native-push] ${stage}: ${result}${detail ? ` (${detail})` : ''}`);
}

function safeErrorSummary(cause: unknown): string {
  if (!cause || typeof cause !== 'object') return 'Unknown error';
  const details: string[] = [];
  const messages: string[] = [];
  let current: unknown = cause;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const error = current as { name?: unknown; code?: unknown; context?: unknown; cause?: unknown; message?: unknown; status?: unknown };
    if (typeof error.name === 'string' && SAFE_PUSH_ERROR_NAMES.has(error.name)) {
      details.push(error.name);
    }
    if (typeof error.code === 'string' && SAFE_PUSH_ERROR_CODES.has(error.code)) {
      details.push(`code ${error.code}`);
    }
    if (typeof error.status === 'number' && Number.isInteger(error.status)) {
      details.push(`HTTP ${error.status}`);
    }
    if (typeof error.message === 'string') {
      const message = error.message
        .replace(/https?:\/\/\S+/gi, '[URL]')
        .replace(/\bBearer\s+\S+/gi, 'Bearer [REDACTED]')
        .replace(/\b(access_token|refresh_token|apikey|api_key|authorization|token|password|secret)(\s*[=:]\s*)\S+/gi, '$1$2[REDACTED]')
        .replace(/\b(?:Expo|Exponent)PushToken\[[^\]]+\]/gi, '[PUSH_TOKEN_REDACTED]')
        .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[TOKEN_REDACTED]')
        .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[REDACTED]')
        .slice(0, 160);
      const networkMessage = message.match(
        /\b(?:network request failed|failed to fetch|fetch failed|request timed out|timed out|timeout|connection (?:refused|reset|closed)|dns (?:lookup )?(?:failed|error)|eai_again|enotfound|econnreset|econnrefused|etimedout|enetunreach|ehostunreach|econnaborted|socket hang up|tls handshake failed|ssl handshake failed|certificate (?:has expired|invalid|verify failed)|aborted)\b/i,
      )?.[0];
      if (networkMessage && !messages.includes(networkMessage)) messages.push(networkMessage);
    }
    current = error.cause ?? (error.context instanceof Error ? error.context : null);
  }
  return [...new Set(details), ...messages.slice(-1)].join(': ') || 'Unknown error';
}

function getExpoProjectId(): string | null {
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  return typeof projectId === 'string' && projectId.trim() ? projectId.trim() : null;
}

export function getNativePushRegistrationStatus(): NativePushRegistrationStatus {
  return registrationStatus;
}

export function subscribeToNativePushRegistrationStatus(
  listener: (status: NativePushRegistrationStatus) => void,
): () => void {
  registrationStatusListeners.add(listener);
  listener(registrationStatus);
  return () => registrationStatusListeners.delete(listener);
}

async function getInstallationId(): Promise<string> {
  const saved = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (saved) return saved;

  const generated = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, generated);
  return generated;
}

export async function ensureNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = await import('expo-notifications');
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNativePushPermission(): Promise<boolean> {
  const [{ isDevice }, Notifications] = await Promise.all([
    import('expo-device'),
    import('expo-notifications'),
  ]);
  if (!isDevice) return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const result = await Notifications.requestPermissionsAsync();
    finalStatus = result.status;
  }
  return finalStatus === 'granted';
}

async function getNativePushToken(projectId: string, devicePushToken?: DevicePushToken): Promise<string | null> {
  const Notifications = await import('expo-notifications');
  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
    ...(devicePushToken ? { devicePushToken } : {}),
  });
  return token.data ?? null;
}

export function registerNativePushTokenForCurrentUser(
  userId: string,
  trigger: NativePushRegistrationTrigger = 'session',
  devicePushToken?: DevicePushToken,
): Promise<boolean> {
  if (!userId || currentIdentity.userId !== userId) return Promise.resolve(false);
  const request: RegistrationRequest = {
    userId,
    generation: currentIdentity.generation,
    trigger,
    ...(devicePushToken ? { devicePushToken } : {}),
  };
  if (registrationDrain) {
    pendingRegistration = request;
    return registrationDrain;
  }

  const drain = drainRegistrationRequests(request);
  registrationDrain = drain;
  return drain.finally(() => {
    if (registrationDrain !== drain) return;
    registrationDrain = null;
    const pending = pendingRegistration;
    pendingRegistration = null;
    if (pending && isCurrentIdentity(pending.userId, pending.generation)) {
      void registerNativePushTokenForCurrentUser(pending.userId, pending.trigger, pending.devicePushToken);
    }
  });
}

async function drainRegistrationRequests(first: RegistrationRequest): Promise<boolean> {
  let request: RegistrationRequest | null = first;
  let result = false;
  while (request) {
    pendingRegistration = null;
    const currentRequest = request;
    result = await enqueueInstallationOperation(() => performNativePushRegistration(
      currentRequest.userId,
      currentRequest.trigger,
      currentRequest.devicePushToken,
      currentRequest.generation,
    ));
    request = pendingRegistration;
  }
  return result;
}

async function performNativePushRegistration(
  userId: string,
  trigger: NativePushRegistrationTrigger,
  devicePushToken?: DevicePushToken,
  generation = currentIdentity.generation,
): Promise<boolean> {
  if (!isCurrentIdentity(userId, generation)) return false;
  const stages: NativePushRegistrationStatus['stages'] = trigger === 'token-refresh'
    ? { tokenRefresh: { result: 'pending', detail: 'Refresh event received; checking registration.' } }
    : {};
  updateRegistrationStatus({
    state: 'checking',
    detail: trigger === 'foreground' ? 'Checking push registration on app foreground.' : 'Checking notification permission and device registration.',
    stages,
  });

  if (!userId) {
    updateStageResult('permission', 'failed', 'Authenticated user unavailable.');
    updateRegistrationStatus({
      state: 'failed',
      detail: 'Sign in to register this device for push notifications.',
      stages: registrationStatus.stages,
    });
    return false;
  }

  let currentStage: NativePushRegistrationStage = 'permission';
  let registrationSucceeded = false;
  let registrationAttempted = false;
  let installationId: string | null = null;
  let token: string | null = null;
  let cacheKey: string | null = null;
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      updateStageResult('permission', 'skipped', 'Unsupported platform.');
      updateRegistrationStatus({
        state: 'unsupported',
        detail: 'Push notifications are supported on physical Android and iOS devices.',
        stages: registrationStatus.stages,
      });
      return false;
    }
    const { isDevice } = await import('expo-device');
    if (!isDevice) {
      updateStageResult('permission', 'skipped', 'A physical device is required.');
      updateRegistrationStatus({
        state: 'unsupported',
        detail: 'Use a physical Android or iOS device to register for push notifications.',
        stages: registrationStatus.stages,
      });
      return false;
    }

    installationId = await getInstallationId();
    reconcileInstallationId(installationId);
    if (!isCurrentIdentity(userId, generation)) return false;
    const retryDelay = getRetryDelay(installationId, userId, devicePushToken);
    if (retryDelay > 0) {
      const stage = trigger === 'token-refresh' ? 'tokenRefresh' : 'permission';
      updateStageResult(stage, 'skipped', 'Retry cooldown active after a recent registration failure.');
      updateRegistrationStatus({
        state: 'failed',
        detail: 'Push registration is cooling down after a recent failure.',
        stages: registrationStatus.stages,
      });
      return false;
    }

    updateStageResult('permission', 'pending', 'Requesting notification permission.');
    await ensureNotificationChannel();
    if (!isCurrentIdentity(userId, generation)) return false;
    const permitted = await requestNativePushPermission();
    if (!isCurrentIdentity(userId, generation)) return false;
    if (!permitted) {
      updateStageResult('permission', 'failed', 'Permission was not granted.');
      updateRegistrationStatus({
        state: 'permission-denied',
        detail: 'Allow notifications in device settings, then reopen the app to register.',
        stages: registrationStatus.stages,
      });
      return false;
    }
    updateStageResult('permission', 'success', 'Permission granted.');

    currentStage = 'projectId';
    updateStageResult(currentStage, 'pending', 'Checking EAS project ID availability.');
    const projectId = getExpoProjectId();
    if (!projectId) {
      updateStageResult(currentStage, 'failed', 'EAS project ID is unavailable in the app config.');
      updateRegistrationStatus({
        state: 'failed',
        detail: 'Expo push registration failed: EAS project ID is unavailable.',
        stages: registrationStatus.stages,
      });
      return false;
    }
    updateStageResult(currentStage, 'success', 'EAS project ID is available.');

    currentStage = 'expoToken';
    updateStageResult(currentStage, 'pending', 'Requesting Expo push token; token value will not be logged.');
    registrationAttempted = true;
    token = await getNativePushToken(projectId, devicePushToken);
    if (!isCurrentIdentity(userId, generation)) return false;
    if (!token) {
      updateStageResult(currentStage, 'failed', 'Expo returned no token.');
      updateRegistrationStatus({
        state: 'failed',
        detail: 'Expo push-token acquisition returned no token.',
        stages: registrationStatus.stages,
      });
      return false;
    }
    updateStageResult(currentStage, 'success', 'Expo push token acquired; value hidden.');
    cacheKey = registrationCacheKey(installationId, userId, token);
    if (registeredTokens.has(cacheKey)) {
      updateStageResult('prepare', 'skipped', 'This Expo push token is already registered for this user.');
      updateRegistrationStatus({
        state: 'registered',
        detail: 'The current Expo push token is already registered.',
        stages: registrationStatus.stages,
      });
      registrationSucceeded = true;
      registrationFailures.delete(registrationOwnerKey(installationId, userId));
      return true;
    }

    currentStage = 'prepare';
    updateStageResult(currentStage, 'pending', 'Preparing local installation metadata.');
    let previousExpoPushToken: string | null;
    try {
      previousExpoPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    } catch (cause) {
      const errorSummary = safeErrorSummary(cause);
      updateStageResult(currentStage, 'failed', `Prepare request not sent; local metadata failed (${errorSummary}).`);
      updateRegistrationStatus({
        state: 'failed',
        detail: `native-device prepare request was not sent because local metadata failed (${errorSummary}).`,
        stages: registrationStatus.stages,
      });
      return false;
    }
    if (!isCurrentIdentity(userId, generation)) return false;
    updateStageResult(currentStage, 'pending', 'Sending native-device prepare request.');
    const { error: prepareError } = await nativeSupabase.functions.invoke('native-device', {
      body: { action: 'prepare', installationId, previousExpoPushToken },
    });
    if (prepareError) throw prepareError;
    updateStageResult(currentStage, 'success', 'native-device prepare succeeded.');

    if (!isCurrentIdentity(userId, generation)) return false;
    currentStage = 'register';
    updateStageResult(currentStage, 'pending', 'Sending native-device register request.');
    const { error } = await nativeSupabase.functions.invoke('native-device', {
      body: {
        action: 'register',
        installationId,
        expoPushToken: token,
        previousExpoPushToken,
        platform: Platform.OS,
      },
    });
    if (error) throw error;
    updateStageResult(currentStage, 'success', 'native-device register succeeded.');
    if (!isCurrentIdentity(userId, generation)) return false;
    try {
      await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    } catch (cause) {
      console.warn(`[native-push] local token cache: failed (${safeErrorSummary(cause)})`);
    }
    updateRegistrationStatus({
      state: 'registered',
      detail: 'Device registration succeeded. Notification delivery has not been confirmed.',
      stages: registrationStatus.stages,
    });
    clearRegisteredTokensForOwner(installationId, userId);
    registeredTokens.add(cacheKey);
    registrationFailures.delete(registrationOwnerKey(installationId, userId));
    registrationSucceeded = true;
    return true;
  } catch (cause) {
    if (isCurrentIdentity(userId, generation)) {
      const errorSummary = safeErrorSummary(cause);
      updateStageResult(currentStage, 'failed', errorSummary);
      updateRegistrationStatus({
        state: 'failed',
        detail: `${NATIVE_PUSH_REGISTRATION_STAGES.find(({ key }) => key === currentStage)?.label ?? 'Push registration'} failed (${errorSummary}).`,
        stages: registrationStatus.stages,
      });
    }
    return false;
  } finally {
    if (registrationAttempted && !registrationSucceeded && installationId && isCurrentIdentity(userId, generation)) {
      clearRegisteredTokensForOwner(installationId, userId);
      recordRegistrationFailure(installationId, userId, devicePushToken);
    }
    if (trigger === 'token-refresh' && isCurrentIdentity(userId, generation)) {
      updateStageResult(
        'tokenRefresh',
        registrationSucceeded ? 'success' : 'failed',
        registrationSucceeded ? 'Registration completed after token refresh.' : 'Registration did not complete after token refresh.',
      );
    }
  }
}

export async function clearNativePushRegistrationForUser(userId: string): Promise<void> {
  if (currentIdentity.userId && currentIdentity.userId !== userId) {
    updateStageResult('logoutRevocation', 'skipped', 'A different authenticated user now owns this installation.');
    return;
  }
  if (currentIdentity.userId === userId) setNativePushRegistrationIdentity(null);
  registeredTokens.clear();
  registrationFailures.delete(registrationOwnerKey(knownInstallationId ?? '', userId));
  if (!userId) {
    updateStageResult('logoutRevocation', 'skipped', 'No authenticated user was available.');
    return;
  }
  await enqueueInstallationOperation(async () => {
    updateStageResult('logoutRevocation', 'pending', 'Revoking this installation for logout.');
    try {
      const installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
      if (!installationId) {
        updateStageResult('logoutRevocation', 'skipped', 'No installation ID was stored.');
        return;
      }
      reconcileInstallationId(installationId);
      const { error } = await nativeSupabase.functions.invoke('native-device', {
        body: { action: 'revoke', installationId },
      });
      if (error) {
        updateStageResult('logoutRevocation', 'failed', safeErrorSummary(error));
        return;
      }
      registeredTokens.clear();
      registrationFailures.delete(registrationOwnerKey(installationId, userId));
      updateStageResult('logoutRevocation', 'success', 'native-device revoke succeeded.');
    } catch (cause) {
      updateStageResult('logoutRevocation', 'failed', safeErrorSummary(cause));
      // Logout remains local if the server cannot be reached; a later account registration reassigns this installation.
    }
  });
}

export function subscribeToNativePushTokenRefresh(userId: string) {
  let active = true;
  let subscription: { remove: () => void } | null = null;
  void import('expo-notifications').then((Notifications) => {
    if (!active) return;
    subscription = Notifications.addPushTokenListener((devicePushToken) => {
      void registerNativePushTokenForCurrentUser(userId, 'token-refresh', devicePushToken);
    });
  }).catch(() => undefined);

  return {
    remove() {
      active = false;
      subscription?.remove();
    },
  };
}
