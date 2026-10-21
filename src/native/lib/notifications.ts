import type { RealtimeChannel } from "@supabase/supabase-js";
import { nativeSupabase } from "./supabase";

export type NativeNotification = {
  id: string;
  type: string;
  user: string;
  avatar: string | null;
  message: string;
  postId: string | null;
  actorId: string | null;
  timestamp: string;
  read: boolean;
};

export function isNativeMessageNotification(type: string) {
  return type === "message" || type === "new_message" || type === "message_received" || type === "call";
}

function isSelfPostActivity(type: string, actorId: string | null, userId: string) {
  return actorId === userId && (type === "like" || type === "comment");
}

export async function fetchNativeNotifications(userId: string): Promise<NativeNotification[]> {
  const { data, error } = await nativeSupabase
    .from("notifications")
    .select("id, type, message, created_at, is_read, actor_id, target_id")
    .eq("user_id", userId)
    .not("type", "in", "(message,new_message,message_received,call)")
    .or(`actor_id.is.null,actor_id.neq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const rows = (data ?? []).filter((item) =>
    !isNativeMessageNotification(item.type ?? "") &&
    !isSelfPostActivity(item.type ?? "", item.actor_id, userId)
  );
  const actorIds = Array.from(new Set(rows.map((item) => item.actor_id).filter(Boolean)));
  const profileById = new Map<string, { username: string; profile_pic: string | null }>();

  if (actorIds.length > 0) {
    const { data: profiles, error: profileError } = await nativeSupabase
      .from("public_profiles")
      .select("id, username, profile_pic")
      .in("id", actorIds);
    if (profileError) throw profileError;
    for (const profile of profiles ?? []) {
      if (profile.id && profile.username) {
        profileById.set(profile.id, {
          username: profile.username,
          profile_pic: profile.profile_pic,
        });
      }
    }
  }

  return rows.map((item) => {
    const actor = item.actor_id ? profileById.get(item.actor_id) : null;
    const rawMessage = item.message?.trim() ?? "";
    const message = actor
      ? rawMessage.replace(new RegExp(`^${escapeRegExp(actor.username)}\\s*[:\\-–—]?\\s*`, "i"), "").trim() || rawMessage
      : rawMessage;
    return {
      id: item.id,
      type: item.type ?? "notification",
      user: actor?.username ?? "Someone",
      avatar: actor?.profile_pic ?? null,
      message,
      postId: item.target_id,
      actorId: item.actor_id,
      timestamp: item.created_at,
      read: item.is_read,
    };
  });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function markNativeNotificationsRead(userId: string) {
  const { error } = await nativeSupabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
  if (error) throw error;
}

export async function deleteNativeNotification(userId: string, notificationId: string) {
  const { error } = await nativeSupabase
    .from("notifications")
    .delete()
    .eq("id", notificationId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteAllNativeNotifications(userId: string) {
  const { error } = await nativeSupabase
    .from("notifications")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

export function subscribeToNativeNotifications(userId: string, onChange: () => void): RealtimeChannel {
  return nativeSupabase
    .channel(`native-notifications:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notification = payload.new as { type?: string; actor_id?: string | null };
        if (isNativeMessageNotification(notification.type ?? "")) return;
        if (!isSelfPostActivity(notification.type ?? "", notification.actor_id ?? null, userId)) {
          onChange();
        }
      },
    )
    .subscribe();
}

export async function fetchNativeNotificationPost(postId: string) {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, video_url, audio_url, image_url, image_original_url")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
