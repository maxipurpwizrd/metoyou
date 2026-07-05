import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type NotificationChangeHandler = () => void;

type NotificationChannelEntry = {
  channel: RealtimeChannel;
  handlers: Set<NotificationChangeHandler>;
};

const notificationChannels = new Map<string, NotificationChannelEntry>();

export type Notification = {
  id: string;
  type: "like" | "comment" | "view" | "follow" | "follow_back" | string;
  user: string;
  avatar?: string | null;
  message: string;
  postId?: string | null;
  timestamp: string;
  read: boolean;
};

export async function getUnreadNotificationCount(userId: string) {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    console.error("getUnreadNotificationCount error", e);
    return 0;
  }
}

export async function markNotificationsRead(userId: string) {
  try {
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId).eq("is_read", false);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("markNotificationsRead error", e);
    return false;
  }
}

export function subscribeToNotifications(userId: string, onChange: () => void): RealtimeChannel {
  const existing = notificationChannels.get(userId);

  if (existing) {
    existing.handlers.add(onChange);

    return new Proxy(existing.channel, {
      get(target, prop) {
        if (prop === "unsubscribe") {
          return () => {
            existing.handlers.delete(onChange);

            if (existing.handlers.size === 0) {
              notificationChannels.delete(userId);
              target.unsubscribe();
            }
          };
        }

        return Reflect.get(target, prop);
      },
    }) as RealtimeChannel;
  }

  const channel = supabase.channel(`notifications:${userId}`);

  channel.on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${userId}`,
    },
    () => {
      for (const handler of notificationChannels.get(userId)?.handlers ?? []) {
        handler();
      }
    }
  );

  channel.subscribe();

  const entry = {
    channel,
    handlers: new Set([onChange]),
  };

  notificationChannels.set(userId, entry);

  return new Proxy(channel, {
    get(target, prop) {
      if (prop === "unsubscribe") {
        return () => {
          entry.handlers.delete(onChange);

          if (entry.handlers.size === 0) {
            notificationChannels.delete(userId);
            target.unsubscribe();
          }
        };
      }

      return Reflect.get(target, prop);
    },
  }) as RealtimeChannel;
}

export async function getNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, message, created_at, is_read")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      type: item.type ?? "notification",
      user: "Someone",
      avatar: null,
      message: item.message ?? "",
      postId: null,
      timestamp: item.created_at ?? new Date().toISOString(),
      read: Boolean(item.is_read),
    })) as Notification[];
  } catch (e) {
    console.error("getNotifications error", e);
    return [] as Notification[];
  }
}
