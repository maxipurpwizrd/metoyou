interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getExistingServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
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

function normalizePushSubscription(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  if (!json.endpoint) return null;

  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export async function subscribeToPushNotifications(registration: ServiceWorkerRegistration): Promise<PushSubscriptionPayload | null> {
  if (!registration.pushManager) return null;

  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return normalizePushSubscription(subscription);
    }

    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: "",
    });

    return normalizePushSubscription(newSubscription);
  } catch (error) {
    console.error("subscribeToPushNotifications error", error);
    return null;
  }
}
