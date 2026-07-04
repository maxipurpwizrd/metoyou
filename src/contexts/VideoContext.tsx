import { createContext, useContext, useState, ReactNode } from "react";

type VideoContextType = {
  playingVideoId: string | null;
  setPlayingVideoId: (id: string | null) => void;
};

const VideoContext = createContext<VideoContextType | undefined>(undefined);

export function VideoProvider({ children }: { children: ReactNode }) {
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  return (
    <VideoContext.Provider value={{ playingVideoId, setPlayingVideoId }}>
      {children}
    </VideoContext.Provider>
  );
}

export function useVideoContext() {
  const context = useContext(VideoContext);
  if (!context) {
    throw new Error("useVideoContext must be used within VideoProvider");
  }
  return context;
}
