import type { PushSubscriptionJSON } from "@supabase/supabase-js";

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getExistingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return await navigator.serviceWorker.getRegistration();
  } catch {
    return null;
  }
}

export async function registerNotificationsServiceWorker(scriptUrl = "/service-worker.js"): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;

  try {
    const existing = await getExistingServiceWorkerRegistration();
    if (existing) return existing;

    return await navigator.serviceWorker.register(scriptUrl);
  } catch (error) {
    console.error("registerNotificationsServiceWorker error", error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }

  return await Notification.requestPermission();
}

export async function subscribeToPushNotifications(registration: ServiceWorkerRegistration): Promise<PushSubscriptionJSON | null> {
  if (!registration.pushManager) return null;

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription.toJSON();
    }

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: "",
    });

    return newSubscription.toJSON();
  } catch (error) {
    console.error("subscribeToPushNotifications error", error);
    return null;
  }
}
