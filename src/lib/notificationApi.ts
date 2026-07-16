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

export async function deleteNotification(userId: string, notificationId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId)
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("deleteNotification error", e);
    return false;
  }
}

export async function deleteAllNotifications(userId: string) {
  try {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", userId);

    if (error) throw error;
    return true;
  } catch (e) {
    console.error("deleteAllNotifications error", e);
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
      .select("id, type, message, created_at, is_read, actor_id, target_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    const notifications = (data || []) as any[];
    const actorIds = Array.from(new Set(notifications.map((item) => item.actor_id).filter(Boolean)));

    const profileMap = new Map<string, { username: string; profile_pic: string | null }>();

    if (actorIds.length > 0) {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, profile_pic")
        .in("id", actorIds as string[]);

      if (profileError) throw profileError;

      (profiles || []).forEach((profile: any) => {
        if (profile?.id) {
          profileMap.set(profile.id, {
            username: profile.username,
            profile_pic: profile.profile_pic,
          });
        }
      });
    }

    const normalizeNotificationMessage = (actorUsername: string | null, message: string) => {
      const trimmed = message.trim();
      if (!actorUsername || !trimmed) return trimmed;

      const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`^${escapeRegExp(actorUsername)}\s*[:\-–—]?\s*`, "i");
      const normalized = trimmed.replace(pattern, "").trim();
      return normalized || trimmed;
    };

    return notifications.map((item: any) => {
      const actor = item.actor_id ? profileMap.get(item.actor_id) : null;
      const rawMessage = item.message ?? "";
      return {
        id: item.id,
        type: item.type ?? "notification",
        user: actor?.username ?? "Someone",
        avatar: actor?.profile_pic ?? null,
        message: normalizeNotificationMessage(actor?.username ?? null, rawMessage),
        postId: item.target_id ?? null,
        timestamp: item.created_at ?? new Date().toISOString(),
        read: Boolean(item.is_read),
      };
    }) as Notification[];
  } catch (e) {
    console.error("getNotifications error", e);
    return [] as Notification[];
  }
}
