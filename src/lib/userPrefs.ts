export interface UserPrefs {
  messageSound?: boolean;
  notifications?: boolean;
}

const KEY = "metoyou:userPrefs";

export function getUserPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as UserPrefs;
  } catch {
    return {};
  }
}

export function setUserPrefs(prefs: UserPrefs) {
  try {
    const existing = getUserPrefs();
    const merged = { ...existing, ...prefs };
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch (err) {
    console.warn("setUserPrefs error", err);
  }
}

export function clearUserPrefs() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
