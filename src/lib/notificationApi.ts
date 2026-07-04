import { supabase } from "./supabase";

export type Notification = {
  id: string;
  type: "like" | "comment" | "view" | "follow" | string;
  user: string;
  avatar?: string | null;
  message: string;
  postId?: string | null;
  timestamp: string;
  read: boolean;
};

export async function getNotifications(userId: string) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select(
        `id, message, created_at, is_read, user:user_id(username, profile_pic)`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((item: any) => ({
      id: item.id,
      type: item.type ?? "notification",
      user: item.user?.username ?? "Someone",
      avatar: item.user?.profile_pic ?? null,
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
