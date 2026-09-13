import { supabase } from "../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { PresenceState } from "../../types/message";

function getPresenceChannelName(conversationId: string): string {
  const normalized = (conversationId ?? "").trim();
  return normalized.startsWith("presence:") ? normalized : `presence:${normalized || "global"}`;
}

function normalizePresenceState(state: unknown): PresenceState {
  const result: PresenceState = {};

  if (!state || typeof state !== "object") {
    return result;
  }

  for (const [userId, entry] of Object.entries(state as Record<string, unknown>)) {
    let meta: any = entry;

    if (meta && typeof meta === "object") {
      if (Array.isArray(meta)) {
        meta = meta[0];
      } else if ("metas" in meta && Array.isArray((meta as any).metas)) {
        meta = (meta as any).metas[0];
      }
    }

    result[userId] = {
      last_active: typeof meta?.last_active === "number" ? meta.last_active : undefined,
      username: typeof meta?.username === "string" ? meta.username : undefined,
    };
  }

  return result;
}

export async function joinPresence(
  conversationId: string,
  userId: string,
  onPresenceChange: (state: PresenceState) => void,
  meta: Record<string, unknown> = {}
): Promise<RealtimeChannel> {
  const channelId = getPresenceChannelName(conversationId);
  const channel = supabase.channel(channelId);

  channel.on("presence", { event: "sync" }, () => {
    try {
      const state = normalizePresenceState((channel as any).presenceState?.());
      onPresenceChange(state);
    } catch (error) {
      console.error("Supabase presence sync failed", error);
    }
  });

  await new Promise<void>((resolve) => {
    let resolved = false;

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" && !resolved) {
        resolved = true;
        resolve();
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 2000);
  });

  try {
    await (channel as any).track({ ...meta, user_id: userId });
  } catch (error) {
    console.error("Supabase presence track failed", error);
  }

  return channel;
}

export async function leavePresence(
  _conversationId: string,
  _userId: string,
  channel?: RealtimeChannel | null
): Promise<void> {
  if (!channel) return;

  try {
    if (typeof (channel as any).untrack === "function") {
      await (channel as any).untrack();
    }
  } catch (error) {
    console.error("Supabase presence untrack failed", error);
  }

  try {
    await channel.unsubscribe();
  } catch (error) {
    console.error("Supabase presence unsubscribe failed", error);
  }
}

export const presenceService = {
  getPresenceChannelName,
  joinPresence,
  leavePresence,
};
