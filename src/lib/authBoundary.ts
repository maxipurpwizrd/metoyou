import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { resetNotificationSubscriptions } from "./notificationApi";
import { resetRealtimeChannelRegistry } from "./realtimeChannelRegistry";

const USER_CHANNEL_PREFIXES = ["messages:", "typing:", "presence:", "notifications:", "calls:"];

let currentAuthUserId: string | null = null;
let authBoundaryVersion = 0;
let teardownInFlight: Promise<void> | null = null;

function isUserChannel(channel: RealtimeChannel) {
  return USER_CHANNEL_PREFIXES.some((prefix) => channel.topic.startsWith(`realtime:${prefix}`));
}

export function setAuthBoundaryUser(userId: string | null) {
  if (currentAuthUserId !== userId) {
    currentAuthUserId = userId;
    authBoundaryVersion += 1;
  }
}

export function getAuthBoundaryVersion() {
  return authBoundaryVersion;
}

export function isCurrentAuthUser(userId: string | null | undefined, version?: number) {
  return Boolean(userId) && currentAuthUserId === userId && (version === undefined || version === authBoundaryVersion);
}

export async function teardownUserRealtimeChannels() {
  if (teardownInFlight) return teardownInFlight;

  teardownInFlight = (async () => {
    const channels = supabase.getChannels().filter(isUserChannel);
    await Promise.allSettled(channels.map((channel) => supabase.removeChannel(channel)));
    resetNotificationSubscriptions();
    resetRealtimeChannelRegistry();
  })().finally(() => {
    teardownInFlight = null;
  });

  return teardownInFlight;
}
