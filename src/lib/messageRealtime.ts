import { BACKEND } from "@/config/backend";
import { supabase } from "./supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Message } from "../types/chat";
import {
  subscribeToMessages as mockSubscribeToMessages,
  sendTypingIndicator as mockSendTypingIndicator,
  subscribeToTyping as mockSubscribeToTyping,
} from "@/services/mock/realtimeHub";

export function getMessagesChannelName(conversationId: string, role = "default"): string {
  return `messages:${conversationId}:${role}`;
}

export function subscribeToMessages(
  conversationId: string,
  callback: (message: Message) => void,
  role = "default"
): RealtimeChannel {
  if (BACKEND === "mock") {
    return mockSubscribeToMessages(conversationId, callback) as unknown as RealtimeChannel;
  }

  const channelName = getMessagesChannelName(conversationId, role);
  const channel = supabase.channel(channelName);

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const message = payload.new as Message;
      if (message && message.id) {
        callback(message);
      }
    }
  );

  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const message = payload.new as Message;
      if (message && message.id) {
        callback(message);
      }
    }
  );

  channel.on(
    "postgres_changes",
    {
      event: "DELETE",
      schema: "public",
      table: "messages",
      filter: `conversation_id=eq.${conversationId}`,
    },
    (payload) => {
      const deletedMessage = payload.old as Message;
      if (deletedMessage && deletedMessage.id) {
        const deleteMarker: Message = {
          ...deletedMessage,
          id: deletedMessage.id,
          text: undefined,
          image_url: undefined,
          audio_url: undefined,
          video_url: undefined,
          metadata: { deleted: true },
        };
        callback(deleteMarker);
      }
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.debug(`Subscribed to messages for conversation ${conversationId}`);
    } else if (status === "CLOSED") {
      console.debug(`Unsubscribed from messages for conversation ${conversationId}`);
    }
  });

  return channel;
}

export async function sendTypingIndicator(
  conversationId: string,
  senderId: string,
  typing: boolean
): Promise<boolean> {
  if (BACKEND === "mock") {
    return mockSendTypingIndicator(conversationId, senderId, typing);
  }

  try {
    const channel = supabase.channel(`typing:${conversationId}`);
    let resolved = false;

    channel.on("broadcast", { event: "typing" }, () => {});

    const subscribePromise = new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED" && !resolved) {
          resolved = true;
          resolve();
        }
      });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }, 2000);
    });

    await subscribePromise;

    let result: any = null;
    try {
      if (typeof (channel as any).httpSend === "function") {
        await (channel as any).httpSend({
          type: "broadcast",
          event: "typing",
          payload: { sender_id: senderId, typing },
        });
        result = "ok";
      } else {
        result = await channel.send({
          type: "broadcast",
          event: "typing",
          payload: { sender_id: senderId, typing },
        });
      }
    } finally {
      try {
        await channel.unsubscribe();
      } catch {
        // ignore
      }
    }

    return result === "ok" || result === true;
  } catch (e) {
    console.error("sendTypingIndicator error", e);
    return false;
  }
}

export function subscribeToTyping(
  conversationId: string,
  callback: (payload: { sender_id: string; typing: boolean }) => void
): RealtimeChannel {
  if (BACKEND === "mock") {
    return mockSubscribeToTyping(conversationId, callback) as unknown as RealtimeChannel;
  }

  const channel = supabase.channel(`typing:${conversationId}`);

  channel.on(
    "broadcast",
    { event: "typing" },
    (evt: { payload: { sender_id: string; typing: boolean } }) => {
      if (evt.payload && evt.payload.sender_id) {
        callback(evt.payload);
      }
    }
  );

  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.debug(`Subscribed to typing for conversation ${conversationId}`);
    }
  });

  return channel;
}
