import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { nativeSupabase } from './supabase';

const INSTALLATION_ID_KEY = 'metoyou.native-push-installation-id';
const PUSH_TOKEN_KEY = 'metoyou.native-push-token';
const SAFE_PUSH_ERROR_NAMES = new Set([
  'AuthSessionMissingError',
  'CodedError',
  'Error',
  'FunctionsFetchError',
  'FunctionsHttpError',
  'FunctionsRelayError',
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
  const error = cause as { name?: unknown; code?: unknown; context?: unknown };
  const details: string[] = [];
  if (typeof error.name === 'string' && SAFE_PUSH_ERROR_NAMES.has(error.name)) {
    details.push(error.name);
  }
  if (typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)) {
    details.push(`code ${error.code}`);
  }
  if (error.context && typeof error.context === 'object' && 'status' in error.context) {
    const status = (error.context as { status?: unknown }).status;
    if (typeof status === 'number' && Number.isInteger(status)) details.push(`HTTP ${status}`);
  }
  return details.join(', ') || 'Unknown error';
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

async function getNativePushToken(projectId: string): Promise<string | null> {
  const Notifications = await import('expo-notifications');
  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  return token.data ?? null;
}

export async function registerNativePushTokenForCurrentUser(
  userId: string,
  trigger: NativePushRegistrationTrigger = 'session',
): Promise<boolean> {
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

    updateStageResult('permission', 'pending', 'Requesting notification permission.');
    await ensureNotificationChannel();
    const permitted = await requestNativePushPermission();
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
    const token = await getNativePushToken(projectId);
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

    currentStage = 'prepare';
    updateStageResult(currentStage, 'pending', 'Preparing local installation metadata.');
    let installationId: string;
    let previousExpoPushToken: string | null;
    try {
      installationId = await getInstallationId();
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
    updateStageResult(currentStage, 'pending', 'Sending native-device prepare request.');
    const { error: prepareError } = await nativeSupabase.functions.invoke('native-device', {
      body: { action: 'prepare', installationId, previousExpoPushToken },
    });
    if (prepareError) throw prepareError;
    updateStageResult(currentStage, 'success', 'native-device prepare succeeded.');

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
    registrationSucceeded = true;
    return true;
  } catch (cause) {
    const errorSummary = safeErrorSummary(cause);
    updateStageResult(currentStage, 'failed', errorSummary);
    updateRegistrationStatus({
      state: 'failed',
      detail: `${NATIVE_PUSH_REGISTRATION_STAGES.find(({ key }) => key === currentStage)?.label ?? 'Push registration'} failed (${errorSummary}).`,
      stages: registrationStatus.stages,
    });
    return false;
  } finally {
    if (trigger === 'token-refresh') {
      updateStageResult(
        'tokenRefresh',
        registrationSucceeded ? 'success' : 'failed',
        registrationSucceeded ? 'Registration completed after token refresh.' : 'Registration did not complete after token refresh.',
      );
    }
  }
}

export async function clearNativePushRegistrationForUser(userId: string): Promise<void> {
  updateStageResult('logoutRevocation', 'pending', 'Revoking this installation for logout.');
  if (!userId) {
    updateStageResult('logoutRevocation', 'skipped', 'No authenticated user was available.');
    return;
  }
  try {
    const installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
    if (!installationId) {
      updateStageResult('logoutRevocation', 'skipped', 'No installation ID was stored.');
      return;
    }
    const { error } = await nativeSupabase.functions.invoke('native-device', {
      body: { action: 'revoke', installationId },
    });
    if (error) {
      updateStageResult('logoutRevocation', 'failed', safeErrorSummary(error));
      return;
    }
    updateStageResult('logoutRevocation', 'success', 'native-device revoke succeeded.');
  } catch (cause) {
    updateStageResult('logoutRevocation', 'failed', safeErrorSummary(cause));
    // Logout remains local if the server cannot be reached; a later account registration reassigns this installation.
  }
}

export function subscribeToNativePushTokenRefresh(userId: string) {
  let active = true;
  let subscription: { remove: () => void } | null = null;
  void import('expo-notifications').then((Notifications) => {
    if (!active) return;
    subscription = Notifications.addPushTokenListener(() => {
      void registerNativePushTokenForCurrentUser(userId, 'token-refresh');
    });
  }).catch(() => undefined);

  return {
    remove() {
      active = false;
      subscription?.remove();
    },
  };
}
