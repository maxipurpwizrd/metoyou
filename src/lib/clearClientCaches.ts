export function clearClientCaches() {
  if (typeof window === "undefined") return;

  const clearStorage = (storage: Storage) => {
    const keys = Object.keys(storage).filter((key) => key.startsWith("metoyou-") || key.startsWith("sb-"));
    for (const key of keys) {
      storage.removeItem(key);
    }
  };

  try {
    clearStorage(window.localStorage);
    clearStorage(window.sessionStorage);
  } catch (error) {
    console.warn("Failed to clear client caches", error);
  }

  window.dispatchEvent(new Event("metoyou:auth-signed-out"));
}
