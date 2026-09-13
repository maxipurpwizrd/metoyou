import { supabase } from "../../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type {
  Conversation,
  Message,
  MessageThread,
  PresenceState,
} from "../../types/chat";
import { presenceService } from "./presence";
import type {
  ChatService,
  ChatMessagePayload,
  UploadProgressCallback,
  TypingPayload,
} from "../interfaces/chat";
import {
  getMessageThreads as getMessageThreadsImpl,
  findOrCreateConversation as findOrCreateConversationImpl,
  fetchMessagesPage as fetchMessagesPageImpl,
  sendMessage as sendMessageImpl,
  markMessagesAsRead as markMessagesAsReadImpl,
  updateConversationLastMessageTime as updateConversationLastMessageTimeImpl,
  fetchMessages as fetchMessagesImpl,
  editMessage as editMessageImpl,
  deleteMessage as deleteMessageImpl,
} from "../../lib/messageCrud";
import {
  subscribeToMessages as subscribeToMessagesImpl,
  sendTypingIndicator as sendTypingIndicatorImpl,
  subscribeToTyping as subscribeToTypingImpl,
} from "../../lib/messageRealtime";

async function getConversation(conversationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    console.error("getConversation error", error);
    return null;
  }

  return data ?? null;
}

async function getUserConversations(userId: string): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .or(`user_1.eq.${userId},user_2.eq.${userId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("getUserConversations error", error);
      return [];
    }

    return data ?? [];
  } catch (error) {
    console.error("getUserConversations exception", error);
    return [];
  }
}

async function deleteConversation(conversationId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from("conversations").delete().eq("id", conversationId);
    if (error) {
      console.error("deleteConversation error", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("deleteConversation exception", error);
    return false;
  }
}

async function getPresence(conversationId: string): Promise<PresenceState> {
  return {};
}

async function subscribeToPresence(conversationId: string, callback: (state: PresenceState) => void): Promise<RealtimeChannel> {
  return presenceService.joinPresence(conversationId, `presence-listener-${Date.now()}`, callback) as unknown as RealtimeChannel;
}

async function uploadAttachment(file: File, path: string, onProgress?: UploadProgressCallback): Promise<string | null> {
  if (onProgress) onProgress(0);

  const { data: signedData, error: signError } = await supabase.storage.from("messages").createSignedUploadUrl(path);
  if (signError || !signedData?.signedUrl) {
    console.error("uploadAttachment createSignedUploadUrl error", signError);
    return null;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedData.signedUrl);
    if (file.type) {
      xhr.setRequestHeader("Content-Type", file.type);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });

  if (onProgress) onProgress(100);
  const { data: urlData, error: urlError } = await supabase.storage.from("messages").getPublicUrl(path);
  if (urlError || !urlData?.publicUrl) {
    console.error("uploadAttachment getPublicUrl error", urlError);
    return null;
  }

  return urlData.publicUrl;
}

async function downloadAttachment(path: string): Promise<Blob | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    return await response.blob();
  } catch (error) {
    console.error("downloadAttachment error", error);
    return null;
  }
}

export const chatService: ChatService = {
  createConversation: findOrCreateConversationImpl,
  findConversation: findOrCreateConversationImpl,
  getConversation,
  getUserConversations,
  deleteConversation,
  getMessages: fetchMessagesImpl,
  sendMessage: sendMessageImpl,
  editMessage: editMessageImpl,
  deleteMessage: deleteMessageImpl,
  markAsRead: markMessagesAsReadImpl,
  markConversationRead: markMessagesAsReadImpl,
  updateConversationLastMessageTime: updateConversationLastMessageTimeImpl,
  subscribeToMessages: subscribeToMessagesImpl,
  unsubscribe: async (channel) => {
    try {
      await channel.unsubscribe();
    } catch {
      // ignore
    }
  },
  startTyping: sendTypingIndicatorImpl,
  stopTyping: async (conversationId, senderId) => sendTypingIndicatorImpl(conversationId, senderId, false),
  subscribeToTyping: subscribeToTypingImpl,
  setOnline: async (conversationId, userId, meta = {}) => {
    return presenceService.joinPresence(conversationId, userId, () => {}, meta) as unknown as RealtimeChannel;
  },
  setOffline: async (conversationId, userId, channel) => {
    return presenceService.leavePresence(conversationId, userId, channel as any);
  },
  getPresence,
  subscribeToPresence,
  loadOlderMessages: fetchMessagesPageImpl,
  loadNewerMessages: async (conversationId, afterCreatedAt, limit = 30) => {
    const messages = await fetchMessagesImpl(conversationId);
    return messages.filter((message) => !afterCreatedAt || message.created_at > afterCreatedAt).slice(0, limit);
  },
  uploadAttachment,
  downloadAttachment,
};
