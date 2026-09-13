import type { Message } from "../../types/chat";

type MessageCallback = (message: Message) => void;
type TypingCallback = (payload: { sender_id: string; typing: boolean }) => void;

type ChannelSubscribers = {
  messages: Set<MessageCallback>;
  typing: Set<TypingCallback>;
};

type TypingStore = Record<string, Record<string, number>>;

const MESSAGE_SUBSCRIBERS = new Map<string, ChannelSubscribers>();
const TYPING_SUBSCRIBERS = new Map<string, ChannelSubscribers>();
const TYPING_KEY = "metoyou_typing";
const TYPING_TIMEOUT_MS = 5000;
const typingExpiryTimers = new Map<string, number>();

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function loadTypingState(): TypingStore {
  if (!isBrowser) return {};
  return safeParse<TypingStore>(window.localStorage.getItem(TYPING_KEY)) ?? {};
}

function saveTypingState(state: TypingStore): void {
  if (!isBrowser) return;
  window.localStorage.setItem(TYPING_KEY, JSON.stringify(state));
}

function getTypingChannelSubscribers(channelId: string): ChannelSubscribers {
  let subscribers = MESSAGE_SUBSCRIBERS.get(channelId);
  if (!subscribers) {
    subscribers = { messages: new Set(), typing: new Set() };
    MESSAGE_SUBSCRIBERS.set(channelId, subscribers);
  }
  return subscribers;
}

function getTypingSubscribers(channelId: string): ChannelSubscribers {
  let subscribers = TYPING_SUBSCRIBERS.get(channelId);
  if (!subscribers) {
    subscribers = { messages: new Set(), typing: new Set() };
    TYPING_SUBSCRIBERS.set(channelId, subscribers);
  }
  return subscribers;
}

function broadcastMessage(conversationId: string, message: Message) {
  const channel = getTypingChannelSubscribers(`messages:${conversationId}`);
  for (const callback of Array.from(channel.messages)) {
    try {
      callback(message);
    } catch {
      // ignore subscriber errors
    }
  }
}

function broadcastTyping(conversationId: string, payload: { sender_id: string; typing: boolean }) {
  const channel = getTypingSubscribers(`typing:${conversationId}`);
  for (const callback of Array.from(channel.typing)) {
    try {
      callback(payload);
    } catch {
      // ignore subscriber errors
    }
  }
}

function scheduleTypingExpiry(conversationId: string, senderId: string) {
  const key = `${conversationId}:${senderId}`;
  const existing = typingExpiryTimers.get(key);
  if (existing) {
    window.clearTimeout(existing);
  }

  const timeoutId = window.setTimeout(() => {
    const state = loadTypingState();
    const conversationTyping = state[conversationId] ?? {};
    const timestamp = conversationTyping[senderId];
    if (!timestamp || Date.now() - timestamp >= TYPING_TIMEOUT_MS) {
      delete conversationTyping[senderId];
      state[conversationId] = conversationTyping;
      saveTypingState(state);
      broadcastTyping(conversationId, { sender_id: senderId, typing: false });
    }
    typingExpiryTimers.delete(key);
  }, TYPING_TIMEOUT_MS);

  typingExpiryTimers.set(key, timeoutId);
}

export function subscribeToMessages(conversationId: string, callback: MessageCallback) {
  const channelId = `messages:${conversationId}`;
  const channel = getTypingChannelSubscribers(channelId);
  channel.messages.add(callback);

  return {
    unsubscribe: () => {
      channel.messages.delete(callback);
    },
  };
}

export function publishMessage(conversationId: string, message: Message) {
  broadcastMessage(conversationId, message);
}

export async function sendTypingIndicator(
  conversationId: string,
  senderId: string,
  typing: boolean
): Promise<boolean> {
  const state = loadTypingState();
  const conversationTyping = state[conversationId] ?? {};

  if (typing) {
    conversationTyping[senderId] = Date.now();
    state[conversationId] = conversationTyping;
    saveTypingState(state);
    broadcastTyping(conversationId, { sender_id: senderId, typing: true });
    scheduleTypingExpiry(conversationId, senderId);
    return true;
  }

  if (conversationTyping[senderId]) {
    delete conversationTyping[senderId];
    state[conversationId] = conversationTyping;
    saveTypingState(state);
    broadcastTyping(conversationId, { sender_id: senderId, typing: false });
  }

  return true;
}

export function subscribeToTyping(conversationId: string, callback: TypingCallback) {
  const channelId = `typing:${conversationId}`;
  const channel = getTypingSubscribers(channelId);
  channel.typing.add(callback);

  const activeTyping = loadTypingState()[conversationId] ?? {};
  for (const senderId of Object.keys(activeTyping)) {
    try {
      callback({ sender_id: senderId, typing: true });
    } catch {
      // ignore subscriber errors
    }
  }

  return {
    unsubscribe: () => {
      channel.typing.delete(callback);
    },
  };
}
