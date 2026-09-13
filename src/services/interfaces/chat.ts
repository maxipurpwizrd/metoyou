import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Conversation, Message, MessageThread, PresenceState } from "../../types/chat";

export type ChatMessagePayload = {
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
};

export type TypingPayload = {
  sender_id: string;
  typing: boolean;
};

export type UploadProgressCallback = (percent: number) => void;

export interface ChatService {
  createConversation(userId1: string, userId2: string): Promise<Conversation | null>;
  findConversation(userId1: string, userId2: string): Promise<Conversation | null>;
  getConversation(conversationId: string): Promise<Conversation | null>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  deleteConversation(conversationId: string): Promise<boolean>;

  getMessages(conversationId: string): Promise<Message[]>;
  sendMessage(message: ChatMessagePayload): Promise<Message | null>;
  editMessage(messageId: string, newText: string, senderId: string): Promise<Message | null>;
  deleteMessage(messageId: string, senderId: string): Promise<boolean>;
  markAsRead(conversationId: string, currentUserId: string): Promise<boolean>;
  markConversationRead(conversationId: string, currentUserId: string): Promise<boolean>;
  updateConversationLastMessageTime(conversationId: string, timestamp: string): Promise<boolean>;

  subscribeToMessages(conversationId: string, callback: (message: Message) => void, role?: string): RealtimeChannel;
  unsubscribe(channel: RealtimeChannel): Promise<void>;

  startTyping(conversationId: string, senderId: string): Promise<boolean>;
  stopTyping(conversationId: string, senderId: string): Promise<boolean>;
  subscribeToTyping(conversationId: string, callback: (payload: TypingPayload) => void): RealtimeChannel;

  setOnline(conversationId: string, userId: string, meta?: Record<string, unknown>): Promise<RealtimeChannel>;
  setOffline(conversationId: string, userId: string, channel?: RealtimeChannel | null): Promise<void>;
  getPresence(conversationId: string): Promise<PresenceState>;
  subscribeToPresence(conversationId: string, callback: (state: PresenceState) => void): RealtimeChannel;

  loadOlderMessages(conversationId: string, beforeCreatedAt?: string, limit?: number): Promise<Message[]>;
  loadNewerMessages(conversationId: string, afterCreatedAt?: string, limit?: number): Promise<Message[]>;

  uploadAttachment(file: File, path: string, onProgress?: UploadProgressCallback): Promise<string | null>;
  downloadAttachment(path: string): Promise<Blob | null>;
}
