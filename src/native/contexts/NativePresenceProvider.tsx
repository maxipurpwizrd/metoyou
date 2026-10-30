import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNativeAuth } from "./NativeAuthProvider";
import { nativeSupabase } from "../lib/supabase";

const LAST_SEEN_CACHE_PREFIX = "metoyou:last-seen:";
const PRESENCE_HEARTBEAT_MS = 30_000;
const LAST_SEEN_CACHE_LIMIT = 500;

type PresenceStatus = {
  isOnline: boolean;
  lastActive: number | null;
};

type PresenceStatuses = Record<string, PresenceStatus>;
type LastSeenCache = Record<string, number>;

const NativePresenceContext = createContext<PresenceStatuses>({});

function normalizePresenceState(state: ReturnType<ReturnType<typeof nativeSupabase.channel>["presenceState"]>) {
  const normalized: LastSeenCache = {};
  for (const [userId, entries] of Object.entries(state)) {
    const entry = entries[entries.length - 1];
    const lastActive = entry?.last_active;
    if (typeof lastActive === "number" && Number.isFinite(lastActive)) {
      normalized[userId] = lastActive;
    }
  }
  return normalized;
}

function parseLastSeenCache(value: string | null): LastSeenCache {
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Saved last-seen data is invalid.");
  }

  const cache: LastSeenCache = {};
  for (const [userId, timestamp] of Object.entries(parsed)) {
    if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
      cache[userId] = timestamp;
    }
  }
  return cache;
}

function mergeLastSeen(...caches: LastSeenCache[]): LastSeenCache {
  const merged: LastSeenCache = {};
  for (const cache of caches) {
    for (const [userId, timestamp] of Object.entries(cache)) {
      merged[userId] = Math.max(merged[userId] ?? 0, timestamp);
    }
  }
  const recent = Object.entries(merged)
    .sort((left, right) => right[1] - left[1])
    .slice(0, LAST_SEEN_CACHE_LIMIT);
  return Object.fromEntries(recent);
}

export function NativePresenceProvider({ children }: { children: ReactNode }) {
  const { session } = useNativeAuth();
  const user = session?.user;
  const userId = user?.id;
  const [onlineUsers, setOnlineUsers] = useState<LastSeenCache>({});
  const [lastSeenByUser, setLastSeenByUser] = useState<LastSeenCache>({});
  const onlineUsersRef = useRef<LastSeenCache>({});
  const lastSeenRef = useRef<LastSeenCache>({});

  useEffect(() => {
    if (!userId) {
      onlineUsersRef.current = {};
      lastSeenRef.current = {};
      setOnlineUsers({});
      setLastSeenByUser({});
      return;
    }

    let active = true;
    const cacheKey = `${LAST_SEEN_CACHE_PREFIX}${userId}`;

    void AsyncStorage.getItem(cacheKey)
      .then((raw) => {
        if (!active) return;
        const cached = parseLastSeenCache(raw);
        const merged = mergeLastSeen(lastSeenRef.current, cached);
        lastSeenRef.current = merged;
        setLastSeenByUser(merged);
      })
      .catch((cause: unknown) => {
        if (active) console.warn("Could not restore saved last-seen statuses.", cause);
      });

    const channel = nativeSupabase.channel("presence:app", {
      config: { presence: { key: userId } },
    });
    let subscribed = false;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let appState: string | null | undefined = AppState.currentState;

    const persistLastSeen = (next: LastSeenCache) => {
      const bounded = mergeLastSeen(next);
      lastSeenRef.current = bounded;
      setLastSeenByUser(bounded);
      void AsyncStorage.setItem(cacheKey, JSON.stringify(bounded)).catch((cause: unknown) => {
        console.warn("Could not save last-seen statuses.", cause);
      });
    };

    const updatePresence = () => {
      if (!active) return;
      const nextOnline = normalizePresenceState(channel.presenceState());
      const previousOnline = onlineUsersRef.current;
      const nextLastSeen = { ...lastSeenRef.current };

      for (const [id, timestamp] of Object.entries(nextOnline)) {
        nextLastSeen[id] = Math.max(nextLastSeen[id] ?? 0, timestamp);
      }
      for (const [id, timestamp] of Object.entries(previousOnline)) {
        if (!(id in nextOnline)) {
          nextLastSeen[id] = Math.max(nextLastSeen[id] ?? 0, timestamp);
        }
      }

      onlineUsersRef.current = nextOnline;
      setOnlineUsers(nextOnline);
      if (Object.keys(nextOnline).length || Object.keys(previousOnline).length) {
        persistLastSeen(nextLastSeen);
      }
    };

    const trackActive = async () => {
      if (!active || !subscribed || appState !== "active") return;
      try {
        await channel.track({
          last_active: Date.now(),
          username: user.email ?? "MeToYou user",
          online_at: new Date().toISOString(),
        });
        updatePresence();
      } catch (cause) {
        console.warn("Could not update native active status.", cause);
      }
    };

    channel.on("presence", { event: "sync" }, updatePresence);
    channel.on("presence", { event: "join" }, updatePresence);
    channel.on("presence", { event: "leave" }, updatePresence);

    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      appState = nextState;
      if (nextState === "active") {
        void trackActive();
      } else if (subscribed) {
        void channel.untrack().catch((cause: unknown) => {
          console.warn("Could not mark the native app inactive.", cause);
        });
      }
    });

    void channel.subscribe((status) => {
      if (!active || status !== "SUBSCRIBED") return;
      subscribed = true;
      updatePresence();
      void trackActive();
      heartbeat = setInterval(() => void trackActive(), PRESENCE_HEARTBEAT_MS);
    });

    return () => {
      active = false;
      subscribed = false;
      if (heartbeat) clearInterval(heartbeat);
      appStateSubscription.remove();
      void channel.untrack().catch((cause: unknown) => {
        console.warn("Could not stop native active status.", cause);
      });
      void nativeSupabase.removeChannel(channel);
    };
  }, [userId, user?.email]);

  const statuses: PresenceStatuses = {};
  for (const [id, timestamp] of Object.entries(lastSeenByUser)) {
    statuses[id] = { isOnline: id in onlineUsers, lastActive: timestamp };
  }
  for (const [id, timestamp] of Object.entries(onlineUsers)) {
    statuses[id] = { isOnline: true, lastActive: timestamp };
  }

  return (
    <NativePresenceContext.Provider value={statuses}>
      {children}
    </NativePresenceContext.Provider>
  );
}

export function useNativePresence(userId: string | undefined) {
  const statuses = useContext(NativePresenceContext);
  return userId ? statuses[userId] ?? { isOnline: false, lastActive: null } : { isOnline: false, lastActive: null };
}
