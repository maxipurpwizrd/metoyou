import { useEffect, useRef } from "react";

type UseAutoplayVideoProps = {
  videoId: string;
  onVisibilityChange?: (isVisible: boolean) => void;
  threshold?: number;
};

export function useAutoplayVideo({
  videoId,
  onVisibilityChange,
  threshold = 0.5,
}: UseAutoplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const isVisible = entry.isIntersecting;
          onVisibilityChange?.(isVisible);

          if (isVisible) {
            // Video is visible, try to play
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise.catch((error) => {
                // Autoplay was prevented or failed
                console.log("Autoplay prevented:", error);
              });
            }
          } else {
            // Video is out of view, pause
            videoElement.pause();
          }
        });
      },
      {
        threshold,
        rootMargin: "0px",
      }
    );

    observer.observe(videoElement);

    return () => {
      observer.unobserve(videoElement);
    };
  }, [videoId, onVisibilityChange, threshold]);

  return videoRef;
}
