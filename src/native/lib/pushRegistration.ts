import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { nativeSupabase } from './supabase';

const INSTALLATION_ID_KEY = 'metoyou.native-push-installation-id';
const PUSH_TOKEN_KEY = 'metoyou.native-push-token';

export type NativePushRegistrationStatus = {
  state: 'checking' | 'registered' | 'permission-denied' | 'build-required' | 'unsupported' | 'failed';
  detail: string;
};

const initialRegistrationStatus: NativePushRegistrationStatus = {
  state: 'checking',
  detail: "Waiting to check this device's push registration.",
};
let registrationStatus = initialRegistrationStatus;
const registrationStatusListeners = new Set<(status: NativePushRegistrationStatus) => void>();

function updateRegistrationStatus(status: NativePushRegistrationStatus) {
  registrationStatus = status;
  for (const listener of registrationStatusListeners) listener(status);
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

export async function getNativePushToken(): Promise<string | null> {
  const { isDevice } = await import('expo-device');
  if (!isDevice || (Platform.OS !== 'android' && Platform.OS !== 'ios')) return null;
  await ensureNotificationChannel();
  const permitted = await requestNativePushPermission();
  if (!permitted) return null;

  const Notifications = await import('expo-notifications');
  const token = await Notifications.getExpoPushTokenAsync({
    projectId: 'dc81f97d-7623-4ad2-84fa-2a52f2a89468',
  });
  return token.data ?? null;
}

export async function registerNativePushTokenForCurrentUser(userId: string): Promise<boolean> {
  if (!userId) {
    updateRegistrationStatus({
      state: 'failed',
      detail: 'Sign in to register this device for push notifications.',
    });
    return false;
  }

  updateRegistrationStatus({
    state: 'checking',
    detail: 'Checking notification permission and device registration.',
  });
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      updateRegistrationStatus({
        state: 'unsupported',
        detail: 'Push notifications are supported on physical Android and iOS devices.',
      });
      return false;
    }
    if (Platform.OS === 'android' && Constants.expoGoConfig !== null) {
      updateRegistrationStatus({
        state: 'build-required',
        detail: 'Remote push on Android requires a development or preview build; Expo Go does not provide it with this SDK.',
      });
      return false;
    }
    const { isDevice } = await import('expo-device');
    if (!isDevice) {
      updateRegistrationStatus({
        state: 'unsupported',
        detail: 'Use a physical Android or iOS device to register for push notifications.',
      });
      return false;
    }

    const token = await getNativePushToken();
    if (!token) {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        updateRegistrationStatus({
          state: 'permission-denied',
          detail: 'Allow notifications in your device settings, then reopen the app to register.',
        });
      } else {
        updateRegistrationStatus({
          state: 'failed',
          detail: 'An Expo push token could not be obtained. Check the app configuration and try again.',
        });
      }
      return false;
    }

    const installationId = await getInstallationId();
    const previousExpoPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    const { error: prepareError } = await nativeSupabase.functions.invoke('native-device', {
      body: { action: 'prepare', installationId, previousExpoPushToken },
    });
    if (prepareError) throw prepareError;

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
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    updateRegistrationStatus({
      state: 'registered',
      detail: 'This device has a push token registered. Successful delivery has not yet been confirmed.',
    });
    return true;
  } catch (cause) {
    console.warn('Could not register this device for native push notifications.', cause);
    updateRegistrationStatus({
      state: 'failed',
      detail: 'Device registration failed. Check your connection and account, then reopen the app to retry.',
    });
    return false;
  }
}

export async function clearNativePushRegistrationForUser(userId: string): Promise<void> {
  if (!userId) return;
  try {
    const installationId = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
    if (!installationId) return;
    await nativeSupabase.functions.invoke('native-device', {
      body: { action: 'revoke', installationId },
    });
  } catch {
    // Logout remains local if the server cannot be reached; a later account registration reassigns this installation.
  }
}

export function subscribeToNativePushTokenRefresh(userId: string) {
  let active = true;
  let subscription: { remove: () => void } | null = null;
  void import('expo-notifications').then((Notifications) => {
    if (!active) return;
    subscription = Notifications.addPushTokenListener(() => {
      void registerNativePushTokenForCurrentUser(userId);
    });
  }).catch(() => undefined);

  return {
    remove() {
      active = false;
      subscription?.remove();
    },
  };
}
