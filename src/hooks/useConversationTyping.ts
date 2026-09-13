import { useCallback, useEffect, useRef, useState } from "react";
import { sendTypingIndicator, subscribeToTyping } from "../lib/messageApi";

interface UseConversationTypingOptions {
  conversationId: string | null;
  userId: string | null;
}

export function useConversationTyping({ conversationId, userId }: UseConversationTypingOptions) {
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingStateRef = useRef(false);
  const typingTimeoutRef = useRef<number | null>(null);

  const stopTyping = useCallback(() => {
    if (!conversationId || !userId || !typingStateRef.current) return;
    typingStateRef.current = false;
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    void sendTypingIndicator(conversationId, userId, false);
  }, [conversationId, userId]);

  const reportTyping = useCallback(
    (text: string) => {
      if (!conversationId || !userId) return;

      const isTyping = text.trim().length > 0;
      if (isTyping && !typingStateRef.current) {
        typingStateRef.current = true;
        void sendTypingIndicator(conversationId, userId, true);
      }

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      if (isTyping) {
        typingTimeoutRef.current = window.setTimeout(() => {
          typingStateRef.current = false;
          void sendTypingIndicator(conversationId, userId, false);
          typingTimeoutRef.current = null;
        }, 1500) as unknown as number;
      } else if (typingStateRef.current) {
        typingStateRef.current = false;
        void sendTypingIndicator(conversationId, userId, false);
      }
    },
    [conversationId, userId]
  );

  useEffect(() => {
    if (!conversationId || !userId) {
      setTypingUsers([]);
      return;
    }

    const typingChannel = subscribeToTyping(conversationId, (payload) => {
      const { sender_id, typing } = payload;
      if (sender_id === userId) return;

      setTypingUsers((prev) => {
        if (typing) {
          if (prev.includes(sender_id)) return prev;
          return [...prev, sender_id];
        }
        return prev.filter((id) => id !== sender_id);
      });
    });

    return () => {
      if (typingChannel) {
        try {
          typingChannel.unsubscribe();
        } catch (error) {
          console.warn("Failed to unsubscribe from typing channel", error);
        }
      }
    };
  }, [conversationId, userId]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (typingStateRef.current && conversationId && userId) {
        void sendTypingIndicator(conversationId, userId, false);
      }
      typingStateRef.current = false;
    };
  }, [conversationId, userId]);

  return { typingUsers, reportTyping, stopTyping };
}
