import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlaylist, setAudioModeAsync, useAudioPlaylistStatus, type AudioMetadata, type AudioPlaylist, type AudioPlaylistStatus } from "expo-audio";
import { toNativeAudioSource } from "../lib/audioSources";
import type { NativeTrack } from "../lib/tracks";

export type NativeMusicQueueEntry = Pick<NativeTrack, "id" | "text" | "username" | "image_url" | "audio_url"> & { assetId?: string };

const MUSIC_STATE_KEY = "metoyou-native-device-music-v1";

type StoredDeviceMusic = {
  version: 1;
  queue: NativeMusicQueueEntry[];
  currentIndex: number;
  currentTime: number;
};

export type NativeMusicQueueSnapshot = {
  queue: NativeMusicQueueEntry[];
  currentIndex: number;
};

type NativeMusicStatus = AudioPlaylistStatus & { error?: unknown };

type NativeMusicContextValue = {
  player: AudioPlaylist;
  status: NativeMusicStatus;
  currentTrack: NativeMusicQueueEntry | null;
  queue: NativeMusicQueueEntry[];
  currentIndex: number;
  isRestored: boolean;
  setTrack: (track: NativeMusicQueueEntry, queue?: NativeMusicQueueEntry[], index?: number) => void;
  setQueue: (queue: NativeMusicQueueEntry[], index?: number) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (seconds: number) => void;
  clear: () => void;
};

const NativeMusicContext = createContext<NativeMusicContextValue | null>(null);

export function NativeMusicProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<AudioPlaylist | null>(null);
  const queueRef = useRef<NativeMusicQueueEntry[]>([]);
  const currentIndexRef = useRef(0);
  const [queue, setQueueState] = useState<NativeMusicQueueEntry[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [currentTrack, setCurrentTrackState] = useState<NativeMusicQueueEntry | null>(null);
  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const [isRestored, setIsRestored] = useState(false);

  if (!playerRef.current) {
    playerRef.current = createAudioPlaylist({ updateInterval: 250 });
  }

  const player = playerRef.current;
  const status = useAudioPlaylistStatus(player) as NativeMusicStatus;
  const statusRef = useRef(status);
  statusRef.current = status;

  const installQueue = useCallback((nextQueue: NativeMusicQueueEntry[], index: number) => {
    const nextIndex = nextQueue.length > 0 ? Math.max(0, Math.min(index, nextQueue.length - 1)) : 0;
    const currentSignature = queueRef.current.map((item) => `${item.id}:${item.audio_url}`).join("\n");
    const nextSignature = nextQueue.map((item) => `${item.id}:${item.audio_url}`).join("\n");
    queueRef.current = nextQueue;
    currentIndexRef.current = nextIndex;
    setQueueState(nextQueue);
    setCurrentIndexState(nextIndex);
    setCurrentTrackState(nextQueue[nextIndex] ?? null);
    currentTrackRef.current = nextQueue[nextIndex] ?? null;

    if (currentSignature !== nextSignature) {
      player.clear();
      nextQueue.forEach((item) => {
        const source = toNativeAudioSource(item);
        if (source) player.add(source);
      });
    }
    if (nextQueue.length > 0 && (currentSignature !== nextSignature || player.currentIndex !== nextIndex)) {
      player.skipTo(nextIndex);
    }
  }, [player]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(MUSIC_STATE_KEY).then((raw) => {
      if (!active || !raw) return;
      try {
        const saved = JSON.parse(raw) as StoredDeviceMusic;
        if (saved.version !== 1 || !Array.isArray(saved.queue) || saved.queue.length === 0) return;
        if (!saved.queue.every((item) => item?.id?.startsWith("device:") && typeof item.audio_url === "string")) return;
        installQueue(saved.queue, saved.currentIndex);
        if (Number.isFinite(saved.currentTime) && saved.currentTime > 0) {
          void player.seekTo(saved.currentTime).catch(() => undefined);
        }
      } catch {
        void AsyncStorage.removeItem(MUSIC_STATE_KEY).catch(() => undefined);
      }
    }).catch(() => undefined).finally(() => {
      if (active) setIsRestored(true);
    });
    return () => {
      active = false;
    };
  }, [installQueue, player]);

  useEffect(() => {
    const subscription = player.addListener("trackChanged", ({ currentIndex: nextIndex }) => {
      const nextTrack = queueRef.current[nextIndex];
      if (!nextTrack) return;
      currentIndexRef.current = nextIndex;
      currentTrackRef.current = nextTrack;
      setCurrentIndexState(nextIndex);
      setCurrentTrackState(nextTrack);
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const persistDeviceMusic = () => {
      const activeTrack = currentTrackRef.current;
      if (!activeTrack?.id.startsWith("device:")) return;
      const saved: StoredDeviceMusic = {
        version: 1,
        queue: queueRef.current,
        currentIndex: currentIndexRef.current,
        currentTime: statusRef.current.currentTime,
      };
      void AsyncStorage.setItem(MUSIC_STATE_KEY, JSON.stringify(saved)).catch(() => undefined);
    };
    const interval = setInterval(persistDeviceMusic, 2500);
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") persistDeviceMusic();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      persistDeviceMusic();
    };
  }, []);

  useEffect(() => {
    void setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentTrack) {
      player.clearLockScreenControls();
      return;
    }

    const metadata: AudioMetadata = {
      title: currentTrack.text?.trim() || "Untitled Track",
      artist: currentTrack.username,
      albumTitle: "MeToYou Tracks",
      artworkUrl: currentTrack.image_url ?? undefined,
    };

    player.setActiveForLockScreen(true, metadata, {
      showNextTrack: true,
      showPreviousTrack: true,
      showSeekForward: false,
      showSeekBackward: false,
    });

  }, [currentTrack, player]);

  const setTrack = useCallback((track: NativeMusicQueueEntry, nextQueue: NativeMusicQueueEntry[] = queueRef.current, index = nextQueue.findIndex((item) => item.id === track.id)) => {
    const selectedIndex = index >= 0 ? index : 0;
    installQueue(nextQueue, selectedIndex);
    const selectedTrack = nextQueue[selectedIndex] ?? track;
    setCurrentTrackState(selectedTrack);
    currentTrackRef.current = selectedTrack;
    if (!selectedTrack.id.startsWith("device:")) {
      void AsyncStorage.removeItem(MUSIC_STATE_KEY).catch(() => undefined);
    }
  }, [installQueue]);

  const setQueue = useCallback((nextQueue: NativeMusicQueueEntry[], index = 0) => {
    if (nextQueue.length > 0) {
      installQueue(nextQueue, index);
      if (!nextQueue[0]?.id.startsWith("device:")) {
        void AsyncStorage.removeItem(MUSIC_STATE_KEY).catch(() => undefined);
      }
      return;
    }
    installQueue([], 0);
  }, [installQueue]);

  const play = useCallback(() => {
    player.play();
  }, [player]);

  const pause = useCallback(() => {
    player.pause();
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) player.pause();
    else player.play();
  }, [player, status.playing]);

  const seekTo = useCallback((seconds: number) => {
    void player.seekTo(seconds);
  }, [player]);

  const clear = useCallback(() => {
    installQueue([], 0);
    player.clearLockScreenControls();
    void AsyncStorage.removeItem(MUSIC_STATE_KEY).catch(() => undefined);
  }, [installQueue, player]);

  const value = useMemo<NativeMusicContextValue>(() => ({
    player,
    status,
    currentTrack,
    queue,
    currentIndex,
    isRestored,
    setTrack,
    setQueue,
    play,
    pause,
    toggle,
    seekTo,
    clear,
  }), [currentIndex, currentTrack, isRestored, player, play, pause, queue, seekTo, setQueue, setTrack, status, toggle, clear]);

  return (
    <NativeMusicContext.Provider value={value}>
      {children}
    </NativeMusicContext.Provider>
  );
}

export function useNativeMusic() {
  const context = useContext(NativeMusicContext);
  if (!context) throw new Error("useNativeMusic must be used within NativeMusicProvider");
  return context;
}
