import { useEffect, useRef } from "react";
import { MediaManager } from "../lib/mediaManager";

type UseAutoplayAudioProps = {
  audioId: string;
  onVisibilityChange?: (isVisible: boolean) => void;
  threshold?: number;
};

export function useAutoplayAudio({
  audioId,
  onVisibilityChange,
  threshold = 0.6,
}: UseAutoplayAudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.intersectionRatio >= threshold;
          onVisibilityChange?.(isVisible);

          if (isVisible) {
            MediaManager.play(audioElement);
          } else {
            MediaManager.stop(audioElement);
          }
        });
      },
      {
        threshold,
        rootMargin: "0px",
      }
    );

    observer.observe(audioElement);

    return () => {
      observer.unobserve(audioElement);
      MediaManager.stop(audioElement);
    };
  }, [audioId, onVisibilityChange, threshold]);

  return audioRef;
}
