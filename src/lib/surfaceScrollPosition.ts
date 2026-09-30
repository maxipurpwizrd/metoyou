type StoredScrollPosition = {
  scrollTop: number;
  viewportHeight: number;
};

export function saveSurfaceScrollPosition(element: HTMLElement, key: string) {
  try {
    const position: StoredScrollPosition = {
      scrollTop: element.scrollTop,
      viewportHeight: element.clientHeight,
    };
    window.sessionStorage.setItem(key, JSON.stringify(position));
  } catch {
    // Ignore unavailable session storage.
  }
}

export function restoreSurfaceScrollPosition(element: HTMLElement, key: string) {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return;

    const position = JSON.parse(raw) as Partial<StoredScrollPosition>;
    if (typeof position.scrollTop !== "number" || !Number.isFinite(position.scrollTop)) return;

    const scale = typeof position.viewportHeight === "number" && position.viewportHeight > 0
      ? element.clientHeight / position.viewportHeight
      : 1;
    element.scrollTop = position.scrollTop * scale;
  } catch {
    // Ignore invalid or unavailable session storage.
  }
}