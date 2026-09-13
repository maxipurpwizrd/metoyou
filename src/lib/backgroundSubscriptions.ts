import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { subscribeToMessages } from "./messageApi";

const channels: Map<string, RealtimeChannel> = new Map();

export async function startBackgroundSubscriptions(userId: string, onMessage: (msg: any) => void) {
  try {
    // Fetch all conversations for this user
    const { data: conversations, error } = await supabase
      .from("conversations")
      .select("id")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`);

    if (error) {
      console.error("startBackgroundSubscriptions fetch conversations failed", error);
      return;
    }

    if (!conversations || conversations.length === 0) return;

    for (const conv of conversations) {
      const convId = conv.id as string;
      if (channels.has(convId)) continue;
      try {
        const ch = subscribeToMessages(convId, onMessage, "background");
        channels.set(convId, ch);
      } catch (e) {
        console.warn("subscribeToMessages failed for", convId, e);
      }
    }
  } catch (e) {
    console.error("startBackgroundSubscriptions error", e);
  }
}

export async function stopBackgroundSubscriptions() {
  try {
    for (const [convId, ch] of channels.entries()) {
      try {
        await ch.unsubscribe();
      } catch (e) {
        console.warn("unsubscribe failed for", convId, e);
      }
    }
    channels.clear();
  } catch (e) {
    console.error("stopBackgroundSubscriptions error", e);
  }
}
