import AsyncStorage from "@react-native-async-storage/async-storage";

export type NativeConversationActionField = "pinnedIds" | "archivedIds" | "unreadIds" | "deletedIds";

export type NativeConversationActions = Record<NativeConversationActionField, string[]>;

const EMPTY_ACTIONS: NativeConversationActions = {
  pinnedIds: [],
  archivedIds: [],
  unreadIds: [],
  deletedIds: [],
};

function getStorageKey(userId: string) {
  return `metoyou-conversation-actions:${userId}`;
}

export async function fetchNativeConversationActions(userId: string): Promise<NativeConversationActions> {
  const raw = await AsyncStorage.getItem(getStorageKey(userId));
  if (!raw) return EMPTY_ACTIONS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY_ACTIONS;
    const value = parsed as Partial<NativeConversationActions>;
    return {
      pinnedIds: Array.isArray(value.pinnedIds) ? value.pinnedIds.filter((id): id is string => typeof id === "string") : [],
      archivedIds: Array.isArray(value.archivedIds) ? value.archivedIds.filter((id): id is string => typeof id === "string") : [],
      unreadIds: Array.isArray(value.unreadIds) ? value.unreadIds.filter((id): id is string => typeof id === "string") : [],
      deletedIds: Array.isArray(value.deletedIds) ? value.deletedIds.filter((id): id is string => typeof id === "string") : [],
    };
  } catch {
    return EMPTY_ACTIONS;
  }
}

export async function setNativeConversationAction(
  userId: string,
  field: NativeConversationActionField,
  conversationId: string,
  enabled: boolean,
): Promise<NativeConversationActions> {
  const current = await fetchNativeConversationActions(userId);
  const ids = new Set(current[field]);
  if (enabled) ids.add(conversationId);
  else ids.delete(conversationId);
  const next = { ...current, [field]: [...ids] };
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  return next;
}

export async function clearNativeConversationActions(
  userId: string,
  conversationId: string,
): Promise<NativeConversationActions> {
  const current = await fetchNativeConversationActions(userId);
  const next = {
    pinnedIds: current.pinnedIds,
    archivedIds: current.archivedIds,
    unreadIds: current.unreadIds.filter((id) => id !== conversationId),
    deletedIds: current.deletedIds,
  };
  await AsyncStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  return next;
}