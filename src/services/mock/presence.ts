import type { PresenceState } from "../../types/chat";

type PresenceListener = (state: PresenceState) => void;

type ChannelState = {
  members: Record<string, PresenceEntry>;
  listeners: Set<PresenceListener>;
};

type PresenceEntry = {
  online: boolean;
  lastSeen: number;
  updatedAt: string;
  username?: string;
};

const STORAGE_PRESENCE_KEY = "metoyou_presence";
const PRESENCE_CHANNELS = new Map<string, ChannelState>();

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadPresenceStore(): Record<string, Record<string, PresenceEntry>> {
  if (!isBrowser) return {};
  return safeParse<Record<string, Record<string, PresenceEntry>>>(window.localStorage.getItem(STORAGE_PRESENCE_KEY)) ?? {};
}

function savePresenceStore(store: Record<string, Record<string, PresenceEntry>>): void {
  if (!isBrowser) return;
  window.localStorage.setItem(STORAGE_PRESENCE_KEY, JSON.stringify(store));
}

function getChannelState(channelId: string): ChannelState {
  let channel = PRESENCE_CHANNELS.get(channelId);
  if (!channel) {
    channel = { members: {}, listeners: new Set() };
    PRESENCE_CHANNELS.set(channelId, channel);
  }
  return channel;
}

function broadcastState(channelId: string) {
  const channel = getChannelState(channelId);
  const state: PresenceState = {};

  for (const [userId, entry] of Object.entries(channel.members)) {
    state[userId] = {
      last_active: entry.lastSeen,
      username: entry.username,
    };
  }

  for (const listener of Array.from(channel.listeners)) {
    try {
      listener(state);
    } catch {
      // ignore listener errors
    }
  }
}

function getPresenceChannelName(conversationId: string): string {
  const normalized = (conversationId ?? "").trim();
  return normalized.startsWith("presence:") ? normalized : `presence:${normalized || "global"}`;
}

export async function joinPresence(
  conversationId: string,
  userId: string,
  onPresenceChange: (state: PresenceState) => void,
  meta: Record<string, unknown> = {}
): Promise<MockPresenceChannel> {
  const channelId = getPresenceChannelName(conversationId);
  const channel = getChannelState(channelId);
  channel.listeners.add(onPresenceChange);

  const store = loadPresenceStore();
  const channelStore = store[channelId] ?? {};
  const nextEntry: PresenceEntry = {
    online: true,
    lastSeen: Date.now(),
    updatedAt: new Date().toISOString(),
    username: typeof meta.username === "string" ? meta.username : undefined,
  };
  channelStore[userId] = nextEntry;
  store[channelId] = channelStore;
  savePresenceStore(store);

  channel.members[userId] = nextEntry;
  broadcastState(channelId);

  const mockChannel: MockPresenceChannel = {
    channelId,
    userId,
    unsubscribe: () => {
      channel.listeners.delete(onPresenceChange);
    },
    untrack: async () => {
      const persistedStore = loadPresenceStore();
      const persistedChannel = persistedStore[channelId] ?? {};
      if (persistedChannel[userId]) {
        persistedChannel[userId] = {
          ...persistedChannel[userId],
          online: false,
          lastSeen: Date.now(),
          updatedAt: new Date().toISOString(),
        };
        persistedStore[channelId] = persistedChannel;
        savePresenceStore(persistedStore);
      }
      delete channel.members[userId];
      broadcastState(channelId);
    },
    track: async (presenceMeta: Record<string, unknown>) => {
      const persistedStore = loadPresenceStore();
      const persistedChannel = persistedStore[channelId] ?? {};
      const existing = persistedChannel[userId] ?? {
        online: true,
        lastSeen: Date.now(),
        updatedAt: new Date().toISOString(),
      };
      const updated = {
        ...existing,
        online: true,
        lastSeen: Date.now(),
        updatedAt: new Date().toISOString(),
        username: typeof presenceMeta.username === "string" ? presenceMeta.username : existing.username,
      };
      persistedChannel[userId] = updated;
      persistedStore[channelId] = persistedChannel;
      savePresenceStore(persistedStore);
      channel.members[userId] = updated;
      broadcastState(channelId);
    },
  };

  return mockChannel;
}

export async function leavePresence(
  _conversationId: string,
  userId: string,
  channel?: MockPresenceChannel | null
): Promise<void> {
  if (!channel) return;

  try {
    await channel.untrack();
  } catch {
    // ignore
  }

  try {
    channel.unsubscribe();
  } catch {
    // ignore
  }
}

export function getPresenceState(conversationId: string): PresenceState {
  const channelId = getPresenceChannelName(conversationId);
  const store = loadPresenceStore();
  const channelStore = store[channelId] ?? {};
  const state: PresenceState = {};

  for (const [userId, entry] of Object.entries(channelStore)) {
    state[userId] = {
      last_active: entry.lastSeen,
      username: entry.username,
    };
  }

  return state;
}

export const presenceService = {
  getPresenceChannelName,
  joinPresence,
  leavePresence,
  getPresenceState,
};
