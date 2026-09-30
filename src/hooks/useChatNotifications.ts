import { useCallback, useState } from "react";
import {
  registerNotificationsServiceWorker,
  requestNotificationPermission,
  sendPushSubscriptionToServer,
  subscribeToPushNotifications,
} from "../lib/notificationPush";
import { getUserPrefs, setUserPrefs } from "../lib/userPrefs";

export function useChatNotifications(userId?: string | null) {
  const [messageSoundEnabled, setMessageSoundEnabled] = useState<boolean>(() => {
    try {
      return getUserPrefs().messageSound ?? true;
    } catch {
      return true;
    }
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      return getUserPrefs().notifications ?? false;
    } catch {
      return true;
    }
  });

  const updateMessageSound = useCallback((nextValue: boolean) => {
    setMessageSoundEnabled(nextValue);
    setUserPrefs({ messageSound: nextValue });
  }, []);

  const updateNotifications = useCallback(async (nextValue: boolean) => {
    setNotificationsEnabled(nextValue);
    setUserPrefs({ notifications: nextValue });

    if (!nextValue) return;

    try {
      const permission = await requestNotificationPermission();
      if (permission !== "granted" || !import.meta.env.PROD) {
        if (permission !== "granted") {
          setNotificationsEnabled(false);
          setUserPrefs({ notifications: false });
        }
        return;
      }

      const registration = await registerNotificationsServiceWorker();
      if (!registration) {
        setNotificationsEnabled(false);
        setUserPrefs({ notifications: false });
        return;
      }

      const subscription = await subscribeToPushNotifications(registration);
      if (subscription) {
        const persisted = await sendPushSubscriptionToServer(subscription, userId ?? undefined);
        if (!persisted) {
          setNotificationsEnabled(false);
          setUserPrefs({ notifications: false });
        }
      } else {
        setNotificationsEnabled(false);
        setUserPrefs({ notifications: false });
      }
    } catch (error) {
      console.warn("enable notifications error", error);
      setNotificationsEnabled(false);
      setUserPrefs({ notifications: false });
    }
  }, [userId]);

  return {
    messageSoundEnabled,
    notificationsEnabled,
    setMessageSoundEnabled: updateMessageSound,
    setNotificationsEnabled: updateNotifications,
  };
}
