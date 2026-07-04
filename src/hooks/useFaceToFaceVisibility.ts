import { useEffect, useRef, useState, type RefObject } from "react";

export default function useFaceToFaceVisibility(containerRef: RefObject<HTMLElement>) {
  const [visible, setVisible] = useState(true);
  const [showLabel, setShowLabel] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const scrollEndTimer = useRef<number | null>(null);

  const clearTimers = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (scrollEndTimer.current) {
      window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = null;
    }
  };

  const showForFiveSeconds = () => {
    setVisible(true);
    setShowLabel(true);

    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
    }

    hideTimer.current = window.setTimeout(() => {
      setVisible(false);
      setShowLabel(false);
      hideTimer.current = null;
    }, 5000);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    showForFiveSeconds();

    const handleScroll = () => {
      clearTimers();
      setVisible(false);
      setShowLabel(false);

      scrollEndTimer.current = window.setTimeout(() => {
        showForFiveSeconds();
        scrollEndTimer.current = null;
      }, 500);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimers();
    };
  }, [containerRef]);

  return { visible, showLabel };
}
