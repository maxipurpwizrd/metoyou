import type { RealtimeChannel } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import type { Message } from "../../types/message";
import { nativeSupabase } from "./supabase";

export type NativeChatAttachment = {
  uri: string;
  name: string;
  mimeType: string;
  size: number | null;
  kind: "image" | "video" | "file";
};

export type NativeChatUpload = {
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  attachmentMetadata?: Record<string, unknown>;
};

export type NativeMessageCursor = {
  createdAt: string;
  id: string;
};

const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024;

function getSafeExtension(name: string, mimeType: string) {
  const fromName = name.match(/\.([a-z0-9]{1,10})$/i)?.[1];
  const fromMime = mimeType.split("/")[1]?.split(/[;+]/)[0];
  const extension = fromName || fromMime || "bin";
  return extension.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
}

async function uploadChatFile(input: {
  conversationId: string;
  uri: string;
  name: string;
  mimeType: string;
}) {
  const file = new File(input.uri);
  const bytes = await file.bytes();
  if (bytes.byteLength > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 25 MB or smaller.");
  }
  if (!bytes.byteLength) throw new Error("The selected file is empty.");

  const path = `${input.conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${getSafeExtension(input.name, input.mimeType)}`;
  const { error } = await nativeSupabase.storage.from("messages").upload(path, bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) throw error;

  const { data } = nativeSupabase.storage.from("messages").getPublicUrl(path);
  if (!data.publicUrl) throw new Error("The uploaded file URL could not be created.");
  return data.publicUrl;
}

export async function uploadNativeChatAttachment(
  attachment: NativeChatAttachment,
  conversationId: string,
): Promise<NativeChatUpload> {
  if (attachment.size !== null && attachment.size > MAX_CHAT_ATTACHMENT_BYTES) {
    throw new Error("Attachments must be 25 MB or smaller.");
  }
  const url = await uploadChatFile({
    conversationId,
    uri: attachment.uri,
    name: attachment.name,
    mimeType: attachment.mimeType,
  });

  if (attachment.kind === "image") return { imageUrl: url };
  if (attachment.kind === "video") return { videoUrl: url };
  return {
    attachmentMetadata: {
      attachment_url: url,
      attachment_name: attachment.name,
      attachment_mime_type: attachment.mimeType,
      attachment_size: attachment.size,
    },
  };
}

export async function uploadNativeVoiceNote(uri: string, conversationId: string) {
  return uploadChatFile({
    conversationId,
    uri,
    name: `${Date.now()}.m4a`,
    mimeType: "audio/mp4",
  });
}

export async function resolveNativeConversation(otherUserId: string) {
  if (!otherUserId) throw new Error("A conversation recipient is required.");
  const { data, error } = await nativeSupabase.rpc("resolve_or_create_conversation", {
    p_other_user_id: otherUserId,
  });
  if (error) throw error;

  const conversationId = typeof data === "string"
    ? data
    : data && typeof data === "object" && "id" in data && typeof data.id === "string"
      ? data.id
      : null;
  if (!conversationId) throw new Error("The conversation could not be opened.");

  const { data: conversation, error: conversationError } = await nativeSupabase
    .from("conversations")
    .select("id, user_1, user_2")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error("The conversation could not be found.");

  return conversation;
}

export async function fetchNativeChatRecipient(userId: string) {
  const { data, error } = await nativeSupabase
    .from("public_profiles")
    .select("id, username, profile_pic")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This profile could not be found.");
  return data;
}

export async function fetchNativeConversationMessages(
  conversationId: string,
  before?: NativeMessageCursor,
  limit = 30,
): Promise<{ messages: Message[]; hasMore: boolean }> {
  let query = nativeSupabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId);
  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`,
    );
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (error) throw error;
  const page = (data ?? []) as Message[];
  const hasMore = page.length > limit;
  return { messages: page.slice(0, limit).reverse(), hasMore };
}

export async function sendNativeMessage(
  conversationId: string,
  senderId: string,
  input: {
    text?: string;
    replyTo?: Message;
    upload?: NativeChatUpload;
    messageType?: string;
    forwarded?: boolean;
  },
): Promise<Message> {
  const metadata: Record<string, unknown> = {
    ...(input.upload?.attachmentMetadata ?? {}),
  };
  if (input.forwarded) metadata.forwarded = true;
  if (input.replyTo) {
    metadata.reply_to_id = input.replyTo.id;
    metadata.reply_to_text = input.replyTo.text ?? null;
  }
  const { data, error } = await nativeSupabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      text: input.text?.trim() || null,
      image_url: input.upload?.imageUrl ?? null,
      video_url: input.upload?.videoUrl ?? null,
      audio_url: input.upload?.audioUrl ?? null,
      message_type: input.messageType ?? null,
      status: "sent",
      metadata: Object.keys(metadata).length ? metadata : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  if (!data) throw new Error("The message was not saved.");

  const { error: conversationError } = await nativeSupabase
    .from("conversations")
    .update({ last_message_at: data.created_at })
    .eq("id", conversationId);
  if (conversationError) {
    console.error("Message was sent, but conversation activity could not be updated.", conversationError);
  }
  return data as Message;
}

export async function markNativeMessagesAsRead(conversationId: string, userId: string) {
  const { data: unreadMessages, error: fetchError } = await nativeSupabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);
  if (fetchError) throw fetchError;
  const ids = (unreadMessages ?? []).map((message) => message.id);
  if (!ids.length) return;

  const { error } = await nativeSupabase.rpc("mark_messages_read", {
    p_message_ids: ids,
  });
  if (error) throw error;
}

export function subscribeToNativeMessages(
  conversationId: string,
  onChange: (message: Message, event: "INSERT" | "UPDATE" | "DELETE") => void,
): RealtimeChannel {
  return nativeSupabase
    .channel(`native-messages:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const deleted = payload.old as Partial<Message>;
          if (deleted.id) {
            onChange({ id: deleted.id } as Message, "DELETE");
          }
          return;
        }
        const message = payload.new as Message;
        if (message?.id) onChange(message, payload.eventType);
      },
    )
    .subscribe();
}

export async function editNativeMessage(messageId: string, senderId: string, text: string) {
  const { data, error } = await nativeSupabase
    .from("messages")
    .update({ text, edited_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Message;
}

export async function deleteNativeMessage(messageId: string, senderId: string) {
  const { data, error } = await nativeSupabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", senderId)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("The message could not be found or deleted.");
}

export async function reactToNativeMessage(messageId: string, emoji: string, action: "add" | "remove") {
  const { data, error } = await nativeSupabase.rpc("react_to_message", {
    p_message_id: messageId,
    p_emoji: emoji,
    p_action: action,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || !("id" in row)) {
    throw new Error("The reaction could not be saved.");
  }
  return row as { id: string; reactions: Record<string, string[]> };
}
