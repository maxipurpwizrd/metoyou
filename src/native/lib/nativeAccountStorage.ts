import AsyncStorage from "@react-native-async-storage/async-storage";

export const NATIVE_LAST_AUTH_USER_ID_KEY = "metoyou-native-last-auth-user";

export async function readLastNativeAuthUserId() {
  return AsyncStorage.getItem(NATIVE_LAST_AUTH_USER_ID_KEY);
}

export async function readPersistedNativeAuthUserId(storageKey: string) {
  const raw = await AsyncStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== "object" || !("user" in stored)) return null;
    const user = stored.user;
    if (!user || typeof user !== "object" || !("id" in user) || typeof user.id !== "string") return null;
    return user.id;
  } catch {
    return null;
  }
}

export async function rememberNativeAuthUserId(userId: string) {
  await AsyncStorage.setItem(NATIVE_LAST_AUTH_USER_ID_KEY, userId);
}

export async function clearLastNativeAuthUserId(userId: string) {
  const storedUserId = await AsyncStorage.getItem(NATIVE_LAST_AUTH_USER_ID_KEY);
  if (storedUserId === userId) await AsyncStorage.removeItem(NATIVE_LAST_AUTH_USER_ID_KEY);
}

export function nativeMessageThreadsCacheKey(userId: string) {
  return `metoyou-threads:${userId}`;
}

export function nativeSavedPostsCacheKey(userId: string) {
  return `metoyou-saved-posts:${userId}`;
}

export function nativeSavedStoriesCacheKey(userId: string) {
  return `metoyou-saved-stories:${userId}`;
}

export function nativeCommentLikesCacheKey(userId: string) {
  return `metoyou-comment-like-state:${userId}`;
}

export function nativeConversationActionsCacheKey(userId: string) {
  return `metoyou-conversation-actions:${userId}`;
}

export async function clearNativeAccountStorage(userId: string) {
  await AsyncStorage.multiRemove([
    nativeMessageThreadsCacheKey(userId),
    nativeSavedPostsCacheKey(userId),
    nativeSavedStoriesCacheKey(userId),
    nativeCommentLikesCacheKey(userId),
    nativeConversationActionsCacheKey(userId),
    `metoyou:last-seen:${userId}`,
    `metoyou-native-theme:${userId}`,
  ]);
}