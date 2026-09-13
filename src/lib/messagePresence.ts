import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceState } from "../types/message";

export function getPresenceChannelName(conversationId: string): string {
  const normalized = (conversationId ?? "").trim();
  return normalized.startsWith("presence:") ? normalized : `presence:${normalized || "global"}`;
}

export function joinPresence(
  conversationId: string,
  userId: string,
  onPresenceChange: (state: PresenceState) => void,
  meta: Record<string, unknown> = {}
): RealtimeChannel | null {
  try {
    const channelName = getPresenceChannelName(conversationId);
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    const broadcastPresenceState = () => {
      const presenceState = channel.presenceState() as PresenceState;
      const formattedState: PresenceState = {};

      Object.entries(presenceState).forEach(([userId, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          const lastPresence = presences[presences.length - 1] as any;
          formattedState[userId] = {
            last_active: lastPresence.last_active ?? Date.now(),
            username: lastPresence.username,
          };
        }
      });

      onPresenceChange(formattedState);
    };

    channel.on("presence", { event: "sync" }, () => {
      broadcastPresenceState();
      console.debug(`Presence synced for conversation ${conversationId}`);
    });

    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      broadcastPresenceState();
      console.debug(`User ${key} joined presence`, newPresences);
    });

    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      broadcastPresenceState();
      console.debug(`User ${key} left presence`, leftPresences);
    });

    void channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        const presenceData = {
          last_active: Date.now(),
          username: typeof meta.username === "string" ? meta.username : undefined,
          online_at: new Date().toISOString(),
        };

        await channel.track(presenceData);
        console.debug(`Joined presence for conversation ${conversationId}`);
      }
    });

    return channel;
  } catch (e) {
    console.error("joinPresence error", e);
    return null;
  }
}

export async function leavePresence(
  conversationId: string,
  _userId: string,
  channel?: RealtimeChannel
): Promise<void> {
  try {
    if (!channel) return;

    try {
      await channel.untrack();
    } catch (untrackError) {
      console.debug(`leavePresence untrack failed for ${conversationId}`, untrackError);
    }

    try {
      await channel.unsubscribe();
    } catch (unsubscribeError) {
      console.debug(`leavePresence unsubscribe failed for ${conversationId}`, unsubscribeError);
    }

    console.debug(`Left presence for conversation ${conversationId}`);
  } catch (e) {
    console.error("leavePresence error", e);
  }
}
