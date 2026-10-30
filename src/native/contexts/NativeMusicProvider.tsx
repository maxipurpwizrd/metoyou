import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer, type AudioMetadata, type AudioStatus } from "expo-audio";
import type { NativeTrack } from "../lib/tracks";

export type NativeMusicQueueEntry = Pick<NativeTrack, "id" | "text" | "username" | "image_url" | "audio_url">;

export type NativeMusicQueueSnapshot = {
  queue: NativeMusicQueueEntry[];
  currentIndex: number;
};

type NativeMusicContextValue = {
  player: AudioPlayer;
  status: AudioStatus;
  currentTrack: NativeMusicQueueEntry | null;
  queue: NativeMusicQueueEntry[];
  currentIndex: number;
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
  const playerRef = useRef<AudioPlayer | null>(null);
  const lastSourceRef = useRef<string | null>(null);
  const [queue, setQueueState] = useState<NativeMusicQueueEntry[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [currentTrack, setCurrentTrackState] = useState<NativeMusicQueueEntry | null>(null);

  if (!playerRef.current) {
    playerRef.current = createAudioPlayer(null, { updateInterval: 250 });
  }

  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    void setAudioModeAsync({
      shouldPlayInBackground: true,
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!currentTrack) {
      lastSourceRef.current = null;
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
      showSeekForward: true,
      showSeekBackward: true,
    });

    const nextSource = currentTrack.audio_url;
    if (nextSource && lastSourceRef.current !== nextSource) {
      player.replace(nextSource);
      lastSourceRef.current = nextSource;
    }
  }, [currentTrack, player]);

  const setTrack = useCallback((track: NativeMusicQueueEntry, nextQueue: NativeMusicQueueEntry[] = queue, index = Math.max(0, nextQueue.findIndex((item) => item.id === track.id))) => {
    setQueueState(nextQueue);
    setCurrentIndexState(index >= 0 ? index : 0);
    setCurrentTrackState(track);
  }, [queue]);

  const setQueue = useCallback((nextQueue: NativeMusicQueueEntry[], index = 0) => {
    setQueueState(nextQueue);
    setCurrentIndexState(index >= 0 && index < nextQueue.length ? index : 0);
    setCurrentTrackState(nextQueue[index] ?? nextQueue[0] ?? null);
  }, []);

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
    setQueueState([]);
    setCurrentIndexState(0);
    setCurrentTrackState(null);
    player.clearLockScreenControls();
    player.pause();
  }, [player]);

  const value = useMemo<NativeMusicContextValue>(() => ({
    player,
    status,
    currentTrack,
    queue,
    currentIndex,
    setTrack,
    setQueue,
    play,
    pause,
    toggle,
    seekTo,
    clear,
  }), [currentIndex, currentTrack, player, play, pause, queue, seekTo, setQueue, setTrack, status, toggle, clear]);

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
