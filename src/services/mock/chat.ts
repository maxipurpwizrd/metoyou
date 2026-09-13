import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Conversation, Message, MessageThread, PresenceState } from "../../types/chat";
import { presenceService } from "./presence";
import type { ChatService, ChatMessagePayload, UploadProgressCallback, TypingPayload } from "../interfaces/chat";
import {
  subscribeToMessages as mockSubscribeToMessages,
  publishMessage as mockPublishMessage,
  sendTypingIndicator as mockSendTypingIndicator,
  subscribeToTyping as mockSubscribeToTyping,
} from "./realtimeHub";
import { userService } from "./users";

const STORAGE_USERS_KEY = "metoyou_users";
const STORAGE_CONVERSATIONS_KEY = "metoyou_conversations";
const STORAGE_MESSAGES_KEY = "metoyou_messages";
const STORAGE_PRESENCE_KEY = "metoyou_presence";
const STORAGE_TYPING_KEY = "metoyou_typing";

const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function load<T>(key: string): T | null {
  if (!isBrowser) return null;
  return safeParse<T>(window.localStorage.getItem(key));
}

function save<T>(key: string, value: T): void {
  if (!isBrowser) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function generateId(prefix = "id"): string {
  if (isBrowser && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

type StoredConversation = {
  id: string;
  participants: [string, string];
  createdAt: string;
  updatedAt: string;
  lastMessageId: string | null;
  unreadCount: number;
};

type StoredMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deleted: boolean;
  deletedAt: string | null;
  attachments: Array<Record<string, unknown>>;
  reactions: Record<string, string[]>;
  readBy: string[];
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  replyToText: string | null;
  status: string | null;
};

type StoredPresenceEntry = {
  online: boolean;
  lastSeen: number;
  updatedAt: string;
  username?: string;
};

function normalizeParticipants(userId1: string, userId2: string): [string, string] | null {
  const clean1 = userId1?.trim();
  const clean2 = userId2?.trim();
  if (!clean1 || !clean2 || clean1 === clean2) return null;
  return clean1 < clean2 ? [clean1, clean2] : [clean2, clean1];
}

function compareIsoDateAsc(a: string, b: string): number {
  return a.localeCompare(b);
}

function compareIsoDateDesc(a: string, b: string): number {
  return b.localeCompare(a);
}

function toConversationType(conversation: StoredConversation): Conversation {
  const [user_1, user_2] = conversation.participants;
  return {
    id: conversation.id,
    participants: conversation.participants,
    user_1,
    user_2,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastMessageId: conversation.lastMessageId,
    unreadCount: conversation.unreadCount,
    created_at: conversation.createdAt,
    last_message_at: conversation.updatedAt,
  } as Conversation;
}

function toMessageType(message: StoredMessage): Message {
  return {
    id: message.id,
    conversation_id: message.conversationId,
    sender_id: message.senderId,
    text: message.body,
    image_url: null,
    audio_url: null,
    video_url: null,
    status: message.deleted ? null : message.status,
    message_type: null,
    metadata: {
      ...message.metadata,
      deleted: message.deleted,
      attachments: message.attachments,
      readBy: message.readBy,
    },
    reactions: message.reactions,
    created_at: message.createdAt,
    edited_at: message.editedAt,
    reply_to_id: message.replyToId,
    reply_to_text: message.replyToText,
    edited: Boolean(message.editedAt),
    deleted: message.deleted,
    attachments: message.attachments,
    readBy: message.readBy,
  } as Message;
}

function loadConversations(): StoredConversation[] {
  return load<StoredConversation[]>(STORAGE_CONVERSATIONS_KEY) ?? [];
}

function saveConversations(conversations: StoredConversation[]): void {
  save(STORAGE_CONVERSATIONS_KEY, conversations);
}

function loadMessages(): StoredMessage[] {
  return load<StoredMessage[]>(STORAGE_MESSAGES_KEY) ?? [];
}

function saveMessages(messages: StoredMessage[]): void {
  save(STORAGE_MESSAGES_KEY, messages);
}

function loadPresence(): Record<string, Record<string, StoredPresenceEntry>> {
  return load<Record<string, Record<string, StoredPresenceEntry>>>(STORAGE_PRESENCE_KEY) ?? {};
}

function savePresence(data: Record<string, Record<string, StoredPresenceEntry>>): void {
  save(STORAGE_PRESENCE_KEY, data);
}

function getConversationById(conversationId: string): StoredConversation | null {
  return loadConversations().find((conversation) => conversation.id === conversationId) ?? null;
}

async function getMessageThreads(userId: string): Promise<MessageThread[]> {
  const conversations = loadConversations().filter((conversation) => conversation.participants.includes(userId));
  const otherIds = Array.from(
    new Set(conversations.map((conversation) => conversation.participants.find((id) => id !== userId) ?? ""))
  ).filter(Boolean);

  const profileEntries = await Promise.all(
    otherIds.map(async (otherId) => {
      const profile = await userService.fetchProfile(otherId);
      return [otherId, profile?.username ?? "User"] as const;
    })
  );

  const profileMap = new Map(profileEntries);

  const messages = loadMessages();
  const lastMessageMap = new Map<string, { text?: string | null; createdAt: string }>();
  const outgoingConversationIds = new Set<string>();

  messages
    .slice()
    .sort((a, b) => compareIsoDateDesc(a.createdAt, b.createdAt))
    .forEach((message) => {
      if (!lastMessageMap.has(message.conversationId)) {
        lastMessageMap.set(message.conversationId, {
          text: message.body,
          createdAt: message.createdAt,
        });
      }
      if (message.senderId === userId) {
        outgoingConversationIds.add(message.conversationId);
      }
    });

  return conversations
    .slice()
    .sort((a, b) => compareIsoDateDesc(a.updatedAt, b.updatedAt))
    .map((conversation) => {
      const otherId = conversation.participants.find((id) => id !== userId) ?? conversation.participants[0];
      const lastMessage = lastMessageMap.get(conversation.id);

      return {
        conversationId: conversation.id,
        otherId,
        otherUsername: profileMap.get(otherId) ?? "User",
        lastText: lastMessage?.text,
        lastTime: lastMessage?.createdAt,
        hasOutgoingMessages: outgoingConversationIds.has(conversation.id),
      };
    });
}

function findConversation(userId1: string, userId2: string): StoredConversation | null {
  const normalized = normalizeParticipants(userId1, userId2);
  if (!normalized) return null;
  return loadConversations().find((conversation) => {
    return (
      conversation.participants[0] === normalized[0] &&
      conversation.participants[1] === normalized[1]
    );
  }) ?? null;
}

async function createConversation(userId1: string, userId2: string): Promise<Conversation | null> {
  const normalized = normalizeParticipants(userId1, userId2);
  if (!normalized) return null;

  const conversations = loadConversations();
  const existing = conversations.find((conversation) =>
    conversation.participants[0] === normalized[0] && conversation.participants[1] === normalized[1]
  );
  if (existing) {
    return toConversationType(existing);
  }

  const newConversation: StoredConversation = {
    id: generateId("conv"),
    participants: normalized,
    createdAt: now(),
    updatedAt: now(),
    lastMessageId: null,
    unreadCount: 0,
  };

  conversations.push(newConversation);
  saveConversations(conversations);

  return toConversationType(newConversation);
}

async function getConversation(conversationId: string): Promise<Conversation | null> {
  const conversation = getConversationById(conversationId);
  return conversation ? toConversationType(conversation) : null;
}

async function getUserConversations(userId: string): Promise<Conversation[]> {
  const conversations = loadConversations()
    .filter((conversation) => conversation.participants.includes(userId))
    .sort((a, b) => compareIsoDateDesc(a.updatedAt, b.updatedAt));

  const messages = loadMessages();

  return conversations.map((conversation) => {
    const unreadCount = messages.filter(
      (message) =>
        message.conversationId === conversation.id &&
        message.senderId !== userId &&
        !message.readBy.includes(userId) &&
        !message.deleted
    ).length;
    return toConversationType({ ...conversation, unreadCount });
  });
}

async function deleteConversation(conversationId: string): Promise<boolean> {
  const conversations = loadConversations();
  const messages = loadMessages();
  const remainingConversations = conversations.filter((conversation) => conversation.id !== conversationId);
  if (remainingConversations.length === conversations.length) {
    return false;
  }

  saveConversations(remainingConversations);
  saveMessages(messages.filter((message) => message.conversationId !== conversationId));
  return true;
}

async function getMessages(conversationId: string): Promise<Message[]> {
  const conversation = getConversationById(conversationId);
  if (!conversation) return [];

  return loadMessages()
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => compareIsoDateAsc(a.createdAt, b.createdAt))
    .map(toMessageType);
}

async function sendMessage(options: ChatMessagePayload): Promise<Message | null> {
  const conversation = getConversationById(options.conversationId);
  if (!conversation) return null;

  if (!conversation.participants.includes(options.senderId)) {
    return null;
  }

  const message: StoredMessage = {
    id: generateId("msg"),
    conversationId: options.conversationId,
    senderId: options.senderId,
    body: options.text ?? null,
    createdAt: now(),
    editedAt: null,
    deleted: false,
    deletedAt: null,
    attachments: [],
    reactions: {},
    readBy: [options.senderId],
    metadata: null,
    replyToId: options.replyToId ?? null,
    replyToText: options.replyToText ?? null,
    status: "sent",
  };

  const messages = loadMessages();
  messages.push(message);
  saveMessages(messages);

  const conversations = loadConversations();
  const conversationIndex = conversations.findIndex((item) => item.id === options.conversationId);
  if (conversationIndex >= 0) {
    conversations[conversationIndex] = {
      ...conversations[conversationIndex],
      updatedAt: message.createdAt,
      lastMessageId: message.id,
    };
    saveConversations(conversations);
  }

  try {
    mockPublishMessage(options.conversationId, toMessageType(message));
  } catch {
    // ignore publish failures in mock runtime
  }

  return toMessageType(message);
}

async function editMessage(messageId: string, newText: string, senderId: string): Promise<Message | null> {
  const messages = loadMessages();
  let updatedMessage: StoredMessage | null = null;

  const updated = messages.map((message) => {
    if (message.id === messageId && message.senderId === senderId && !message.deleted) {
      updatedMessage = {
        ...message,
        body: newText.trim(),
        editedAt: now(),
      };
      return updatedMessage;
    }
    return message;
  });

  if (updatedMessage) {
    saveMessages(updated);
    try {
      mockPublishMessage(updatedMessage.conversationId, toMessageType(updatedMessage));
    } catch {
      // ignore
    }
  }

  return updatedMessage ? toMessageType(updatedMessage) : null;
}

async function deleteMessage(messageId: string, senderId: string): Promise<boolean> {
  const messages = loadMessages();
  let wasDeleted = false;
  const updated = messages.map((message) => {
    if (message.id === messageId && message.senderId === senderId && !message.deleted) {
      wasDeleted = true;
      const deletedMessage = {
        ...message,
        deleted: true,
        deletedAt: now(),
        body: null,
        metadata: { ...message.metadata, deleted: true },
      };
      return deletedMessage;
    }
    return message;
  });

  if (!wasDeleted) return false;

  saveMessages(updated);
  const deletedMessage = updated.find((message) => message.id === messageId);
  if (deletedMessage) {
    try {
      mockPublishMessage(deletedMessage.conversationId, toMessageType(deletedMessage));
    } catch {
      // ignore
    }
  }

  return true;
}

async function markAsRead(conversationId: string, currentUserId: string): Promise<boolean> {
  const messages = loadMessages();
  let changed = false;

  const updated = messages.map((message) => {
    if (
      message.conversationId === conversationId &&
      message.senderId !== currentUserId &&
      !message.deleted &&
      !message.readBy.includes(currentUserId)
    ) {
      changed = true;
      return {
        ...message,
        readBy: [...message.readBy, currentUserId],
        status: "read",
      };
    }
    return message;
  });

  if (changed) {
    saveMessages(updated);
  }

  return true;
}

async function updateConversationLastMessageTime(conversationId: string, timestamp: string): Promise<boolean> {
  const conversations = loadConversations();
  const index = conversations.findIndex((conversation) => conversation.id === conversationId);
  if (index < 0) return false;

  conversations[index] = {
    ...conversations[index],
    updatedAt: timestamp,
    lastMessageId: conversations[index].lastMessageId,
  };
  saveConversations(conversations);
  return true;
}

async function loadOlderMessages(conversationId: string, beforeCreatedAt?: string, limit = 30): Promise<Message[]> {
  const messages = await getMessages(conversationId);
  if (!beforeCreatedAt) {
    return messages.slice(-limit).reverse();
  }

  const olderMessages = messages.filter((message) => message.created_at < beforeCreatedAt);
  return olderMessages.slice(-limit);
}

async function loadNewerMessages(conversationId: string, afterCreatedAt?: string, limit = 30): Promise<Message[]> {
  const messages = await getMessages(conversationId);
  return messages.filter((message) => !afterCreatedAt || message.created_at > afterCreatedAt).slice(0, limit);
}

async function fetchMessagesPage(
  conversationId: string,
  beforeCreatedAt?: string,
  limit = 30
): Promise<Message[]> {
  return loadOlderMessages(conversationId, beforeCreatedAt, limit);
}

async function getPresence(conversationId: string): Promise<PresenceState> {
  if (typeof presenceService.getPresenceState === "function") {
    return presenceService.getPresenceState(conversationId);
  }
  return {};
}

async function subscribeToPresence(conversationId: string, callback: (state: PresenceState) => void): Promise<RealtimeChannel> {
  return presenceService.joinPresence(conversationId, `presence-listener-${generateId()}`, callback) as unknown as RealtimeChannel;
}

async function uploadAttachment(file: File, path: string, onProgress?: UploadProgressCallback): Promise<string | null> {
  if (onProgress) onProgress(0);
  const objectUrl = URL.createObjectURL(file);
  if (onProgress) onProgress(100);
  return objectUrl;
}

async function downloadAttachment(path: string): Promise<Blob | null> {
  if (!path) return null;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export const chatService = {
  createConversation,
  findConversation: async (userId1: string, userId2: string) => {
    return findConversation(userId1, userId2) ? toConversationType(findConversation(userId1, userId2)!) : await createConversation(userId1, userId2);
  },
  getConversation,
  getUserConversations,
  deleteConversation,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  markConversationRead: markAsRead,
  updateConversationLastMessageTime,
  subscribeToMessages: (conversationId: string, callback: (message: Message) => void) =>
    mockSubscribeToMessages(conversationId, callback) as unknown as RealtimeChannel,
  unsubscribe: async (channel: RealtimeChannel) => {
    try {
      await (channel as unknown as { unsubscribe?: () => Promise<void> | void }).unsubscribe?.();
    } catch {
      // ignore
    }
  },
  startTyping: async (conversationId: string, senderId: string) => mockSendTypingIndicator(conversationId, senderId, true),
  stopTyping: async (conversationId: string, senderId: string) => mockSendTypingIndicator(conversationId, senderId, false),
  subscribeToTyping: (conversationId: string, callback: (payload: TypingPayload) => void) =>
    mockSubscribeToTyping(conversationId, callback) as unknown as RealtimeChannel,
  setOnline: async (conversationId: string, userId: string, meta = {}) => {
    return presenceService.joinPresence(conversationId, userId, () => {}, meta) as unknown as RealtimeChannel;
  },
  setOffline: async (conversationId: string, userId: string, channel) => {
    return presenceService.leavePresence(conversationId, userId, channel as any);
  },
  getPresence,
  subscribeToPresence,
  loadOlderMessages,
  loadNewerMessages,
  fetchMessagesPage,
  findOrCreateConversation: async (userId1: string, userId2: string) => {
    const existing = findConversation(userId1, userId2);
    return existing ? toConversationType(existing) : await createConversation(userId1, userId2);
  },
  getMessageThreads,
  sendChatMessage: sendMessage,
  markMessagesAsRead: markAsRead,
  updateConversationLastMessageTime,
  uploadAttachment,
  downloadAttachment,
};
