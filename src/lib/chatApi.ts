import type {
  Conversation,
  Message,
  MessageThread,
  PresenceState,
} from "./messageApi";
import {
  findOrCreateConversation as findOrCreateConversationImpl,
  fetchMessagesPage as fetchMessagesPageImpl,
  sendMessage as sendMessageImpl,
  markMessagesAsRead as markMessagesAsReadImpl,
  updateConversationLastMessageTime as updateConversationLastMessageTimeImpl,
  getMessageThreads as getMessageThreadsImpl,
} from "./messageCrud";
import { subscribeToMessages as subscribeToMessagesImpl } from "./messageRealtime";

export type { Conversation, Message, MessageThread, PresenceState };

export async function getMessageThreads(userId: string): Promise<MessageThread[]> {
  return getMessageThreadsImpl(userId);
}

export async function findOrCreateConversation(
  userId1: string,
  userId2: string
): Promise<Conversation | null> {
  return findOrCreateConversationImpl(userId1, userId2);
}

export async function fetchMessagesPage(
  conversationId: string,
  beforeCreatedAt?: string,
  limit = 30
): Promise<Message[]> {
  return fetchMessagesPageImpl(conversationId, beforeCreatedAt, limit);
}

export async function sendChatMessage(options: {
  conversationId: string;
  senderId: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  replyToId?: string | null;
  replyToText?: string | null;
}): Promise<Message | null> {
  return sendMessageImpl({
    conversationId: options.conversationId,
    senderId: options.senderId,
    text: options.text,
    imageUrl: options.imageUrl,
    audioUrl: options.audioUrl,
    videoUrl: options.videoUrl,
    messageType: options.messageType,
    metadata: options.metadata,
    replyToId: options.replyToId,
    replyToText: options.replyToText,
  });
}

export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void,
  role?: string
) {
  return subscribeToMessagesImpl(conversationId, callback, role);
}

export async function markMessagesAsRead(
  conversationId: string,
  currentUserId: string
): Promise<boolean> {
  return markMessagesAsReadImpl(conversationId, currentUserId);
}

export async function updateConversationLastMessageTime(
  conversationId: string,
  timestamp: string
): Promise<boolean> {
  return updateConversationLastMessageTimeImpl(conversationId, timestamp);
}
