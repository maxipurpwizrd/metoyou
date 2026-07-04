import { useEffect } from "react";

const PREFIX = "metoyou-scroll:";

function keyFor(path: string) {
  return PREFIX + path;
}

export default function ScrollRestoration() {
  useEffect(() => {
    let currentPath = window.location.pathname + window.location.search;

    const restoreFor = (path: string) => {
      const key = keyFor(path);
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const y = parseInt(saved, 10) || 0;
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    };

    const saveFor = (path: string) => {
      const key = keyFor(path);
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch (e) {}
    };

    // Restore on mount
    restoreFor(currentPath);

    const handleSave = () => saveFor(currentPath);
    const handlePop = () => {
      saveFor(currentPath);
      currentPath = window.location.pathname + window.location.search;
      restoreFor(currentPath);
    };

    window.addEventListener("beforeunload", handleSave);
    window.addEventListener("pagehide", handleSave);
    window.addEventListener("popstate", handlePop);

    // Patch history methods to detect SPA navigation (pushState/replaceState)
    const origPush = history.pushState;
    const origReplace = history.replaceState;

    (history as any).pushState = function (...args: any[]) {
      origPush.apply(this, args as any);
      saveFor(currentPath);
      currentPath = window.location.pathname + window.location.search;
      window.dispatchEvent(new Event("metoyou:locationchange"));
    };

    (history as any).replaceState = function (...args: any[]) {
      origReplace.apply(this, args as any);
      saveFor(currentPath);
      currentPath = window.location.pathname + window.location.search;
      window.dispatchEvent(new Event("metoyou:locationchange"));
    };

    const onLocationChange = () => restoreFor(window.location.pathname + window.location.search);
    window.addEventListener("metoyou:locationchange", onLocationChange);

    return () => {
      handleSave();
      window.removeEventListener("beforeunload", handleSave);
      window.removeEventListener("pagehide", handleSave);
      window.removeEventListener("popstate", handlePop);
      window.removeEventListener("metoyou:locationchange", onLocationChange);
      (history as any).pushState = origPush;
      (history as any).replaceState = origReplace;
    };
  }, []);

  return null;
}
