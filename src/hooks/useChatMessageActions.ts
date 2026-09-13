import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  sendMessage as sendMessageApi,
  updateConversationLastMessageTime,
  mergeMessages,
  editMessage,
  deleteMessage,
  type Message,
} from "../lib/messageApi";

interface UseChatMessageActionsOptions {
  conversationId: string | null;
  userId: string | null;
  recipientId: string;
  recipientName: string;
  profile?: { username?: string | null } | null;
  setMessages: Dispatch<SetStateAction<Message[]>>;
}

function formatDurationForMissedCall(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function useChatMessageActions({
  conversationId,
  userId,
  recipientId,
  recipientName,
  profile,
  setMessages,
}: UseChatMessageActionsOptions) {
  const appendMissedCallMessage = useCallback(
    async (callType: "audio" | "video", durationSeconds: number) => {
      if (!conversationId || !userId || !recipientId) return;

      const callerUsername = profile?.username ?? "Unknown";
      const missedCallText = `Missed call to ${recipientName}. Rang for ${formatDurationForMissedCall(durationSeconds)}.`;

      const missedMessage = await sendMessageApi({
        conversationId,
        senderId: userId,
        messageType: "missed_call",
        text: missedCallText,
        metadata: {
          callerUsername,
          calleeUsername: recipientName,
          callType,
          durationSeconds,
        },
      });

      if (!missedMessage) return;

      setMessages((current) => mergeMessages([...current, missedMessage]));
      void updateConversationLastMessageTime(conversationId, missedMessage.created_at);
    },
    [conversationId, userId, recipientId, recipientName, profile?.username, setMessages]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, newText: string) => {
      if (!userId) return;
      const updated = await editMessage(messageId, newText, userId);
      if (updated) {
        setMessages((current) => mergeMessages(current.map((msg) => (msg.id === messageId ? updated : msg))));
      } else {
        alert("Failed to edit message. You can only edit your own messages.");
      }
    },
    [setMessages, userId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!userId) return;
      const success = await deleteMessage(messageId, userId);
      if (success) {
        setMessages((current) => current.filter((msg) => msg.id !== messageId));
      } else {
        alert("Failed to delete message. You can only delete your own messages.");
      }
    },
    [setMessages, userId]
  );

  return {
    appendMissedCallMessage,
    handleEditMessage,
    handleDeleteMessage,
  };
}
