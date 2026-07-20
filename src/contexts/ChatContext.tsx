import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import type { Message } from "../types/message";

interface ConversationCache {
  messages: Message[];
  timestamp: number;
}

interface ChatContextType {
  messageCache: Map<string, ConversationCache>;
  getCachedMessages: (conversationId: string) => Message[] | null;
  setCachedMessages: (conversationId: string, messages: Message[]) => void;
  addMessageToCache: (conversationId: string, message: Message) => void;
  clearCache: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messageCache, setMessageCache] = useState<Map<string, ConversationCache>>(new Map());
  const messageCacheRef = useRef<Map<string, ConversationCache>>(new Map());

  const getCachedMessages = useCallback((conversationId: string) => {
    const cached = messageCacheRef.current.get(conversationId);
    if (cached) {
      return cached.messages;
    }
    return null;
  }, []);

  const setCachedMessages = useCallback((conversationId: string, messages: Message[]) => {
    setMessageCache((prev) => {
      const newCache = new Map(prev);
      newCache.set(conversationId, {
        messages,
        timestamp: Date.now(),
      });
      messageCacheRef.current = newCache;
      return newCache;
    });
  }, []);

  const addMessageToCache = useCallback((conversationId: string, message: Message) => {
    setMessageCache((prev) => {
      const newCache = new Map(prev);
      const cached = newCache.get(conversationId);

      if (cached) {
        const exists = cached.messages.some((msg) => msg.id === message.id);
        newCache.set(conversationId, {
          messages: exists ? cached.messages : [...cached.messages, message],
          timestamp: Date.now(),
        });
      } else {
        newCache.set(conversationId, {
          messages: [message],
          timestamp: Date.now(),
        });
      }

      messageCacheRef.current = newCache;
      return newCache;
    });
  }, []);

  const clearCache = useCallback(() => {
    const cleared = new Map<string, ConversationCache>();
    messageCacheRef.current = cleared;
    setMessageCache(cleared);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messageCache,
        getCachedMessages,
        setCachedMessages,
        addMessageToCache,
        clearCache,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within ChatProvider");
  }
  return context;
}
