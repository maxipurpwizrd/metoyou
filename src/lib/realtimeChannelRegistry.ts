import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type ChannelEntry = {
  channel: RealtimeChannel;
  owners: Set<string>;
};

const channels = new Map<string, ChannelEntry>();

export function acquireRealtimeChannel(channelName: string, owner: string, config?: Parameters<typeof supabase.channel>[1]) {
  const existing = channels.get(channelName);
  if (existing) {
    existing.owners.add(owner);
    return existing.channel;
  }

  const channel = supabase.channel(channelName, config);
  channels.set(channelName, { channel, owners: new Set([owner]) });
  if (import.meta.env.DEV) {
    console.debug("[RealtimeLifecycle] create", { channelName, owner, activeUserChannels: channels.size });
  }
  return channel;
}

export function hasTrackedRealtimeChannel(channelName: string) {
  return channels.has(channelName);
}

export async function releaseRealtimeChannel(channelName: string, owner: string, reason: string) {
  const entry = channels.get(channelName);
  if (!entry) return;

  entry.owners.delete(owner);
  if (entry.owners.size > 0) return;

  channels.delete(channelName);
  if (import.meta.env.DEV) {
    console.debug("[RealtimeLifecycle] remove", {
      channelName,
      owner,
      reason,
      activeUserChannels: channels.size,
    });
  }
  await supabase.removeChannel(entry.channel);
}

export function getTrackedRealtimeChannelCount() {
  return channels.size;
}

export function resetRealtimeChannelRegistry() {
  channels.clear();
}
