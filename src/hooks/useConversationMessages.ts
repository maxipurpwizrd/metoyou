import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../contexts/ChatContext";
import { useAuth } from "../hooks/useAuth";
import {
  findOrCreateConversation,
  fetchMessagesPage,
  sendChatMessage,
  subscribeToMessages,
  markMessagesAsRead,
  updateConversationLastMessageTime,
} from "../lib/chatApi";
import { mergeMessages } from "../lib/messageApi";
import type { Message } from "../lib/messageApi";

interface UseConversationMessagesOptions {
  recipientId: string;
  initialConversationId?: string | null;
  onNewMessage?: (message: Message) => void;
}

interface SendConversationMessageOptions {
  conversationId?: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  videoUrl?: string;
  messageType?: string;
  metadata?: Record<string, unknown> | null;
  replyToId?: string | null;
  replyToText?: string | null;
}

interface UseConversationMessagesResult {
  conversationId: string | null;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loading: boolean;
  loadingMore: boolean;
  sending: boolean;
  sendError: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  sendMessage: (options: SendConversationMessageOptions) => Promise<Message | null>;
  setConversationId: (conversationId: string | null) => void;
}

export function useConversationMessages({ recipientId, initialConversationId, onNewMessage }: UseConversationMessagesOptions): UseConversationMessagesResult {
  const { user } = useAuth();
  const userId = user?.id;
  const { getCachedMessages, setCachedMessages, addMessageToCache } = useChat();

  const [conversationId, setConversationIdState] = useState<string | null>(initialConversationId ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const messagesLoadVersionRef = useRef(0);
  const subscriptionRef = useRef<any>(null);
  const activeConversationIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const resolveConversation = useCallback(async () => {
    if (!userId || !recipientId) {
      setConversationIdState(null);
      return null;
    }

    const conversation = await findOrCreateConversation(userId, recipientId);
    if (!conversation) {
      setSendError("Unable to open this chat. Please try again.");
      setConversationIdState(null);
      return null;
    }

    setConversationIdState(conversation.id);
    return conversation.id;
  }, [recipientId, userId]);

  const loadMessages = useCallback(async (conversationIdToLoad: string) => {
    setLoading(true);
    const currentLoadVersion = ++messagesLoadVersionRef.current;

    const cached = getCachedMessages(conversationIdToLoad);
    if (cached && cached.length > 0) {
      setMessages((currentMessages) => mergeMessages([...currentMessages, ...cached]));
      setLoading(false);
      setHasMore(true);
    }

    try {
      const page = await fetchMessagesPage(conversationIdToLoad, undefined, 31);
      if (!isMountedRef.current || currentLoadVersion !== messagesLoadVersionRef.current) {
        return;
      }

      const visible = page.slice(0, 30);
      setMessages((currentMessages) => mergeMessages([...currentMessages, ...visible]));
      setHasMore(page.length > 30);
      setCachedMessages(conversationIdToLoad, visible);
      if (userId) {
        await markMessagesAsRead(conversationIdToLoad, userId);
      }
    } catch (error) {
      console.error("useConversationMessages loadMessages error", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [getCachedMessages, setCachedMessages, userId]);

  const onNewMessageRef = useRef(onNewMessage);
  // keep ref up to date without recreating subscribe callback
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  const subscribe = useCallback((conversationIdToSubscribe: string) => {
    if (activeConversationIdRef.current === conversationIdToSubscribe && subscriptionRef.current) {
      return subscriptionRef.current;
    }

    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.unsubscribe();
      } catch (err) {
        console.warn("Failed to unsubscribe previous conversation", err);
      }
      subscriptionRef.current = null;
    }

    activeConversationIdRef.current = conversationIdToSubscribe;
    subscriptionRef.current = subscribeToMessages(conversationIdToSubscribe, (newMessage) => {
      try {
        console.debug("useConversationMessages - received message callback", { conversationId: conversationIdToSubscribe, id: newMessage?.id, sender_id: newMessage?.sender_id });
      } catch (_) {}
      // call latest onNewMessage without capturing it in subscribe's deps
      try {
        onNewMessageRef.current?.(newMessage);
      } catch (_) {}
      if ((newMessage.metadata as any)?.deleted) {
        setMessages((current) => current.filter((msg) => msg.id !== newMessage.id));
        return;
      }

      setMessages((current) => {
        const exists = current.some((msg) => msg.id === newMessage.id);
        const next = exists
          ? mergeMessages(current.map((msg) => (msg.id === newMessage.id ? newMessage : msg)))
          : mergeMessages([...current, newMessage]);
        return next;
      });

      addMessageToCache(conversationIdToSubscribe, newMessage);
    });

    return subscriptionRef.current;
  }, [addMessageToCache]);

  const loadMore = useCallback(async () => {
    if (!conversationId || messages.length === 0) return;
    const oldest = messages[0];
    if (!oldest?.created_at) return;

    setLoadingMore(true);
    try {
      const older = await fetchMessagesPage(conversationId, oldest.created_at, 30);
      setMessages((current) => mergeMessages([...older, ...current]));
      if (older.length < 30) {
        setHasMore(false);
      }
      older.forEach((message) => addMessageToCache(conversationId, message));
    } catch (error) {
      console.error("useConversationMessages loadMore error", error);
    } finally {
      if (isMountedRef.current) {
        setLoadingMore(false);
      }
    }
  }, [addMessageToCache, conversationId, messages]);

  const sendMessage = useCallback(async (options: {
    conversationId?: string;
    text?: string;
    imageUrl?: string;
    audioUrl?: string;
    videoUrl?: string;
    messageType?: string;
    metadata?: Record<string, unknown> | null;
    replyToId?: string | null;
    replyToText?: string | null;
  }) => {
    const targetConversationId = options.conversationId ?? conversationId;
    if (!targetConversationId || !userId) {
      setSendError("Chat is not ready yet.");
      return null;
    }

    if (!conversationId && options.conversationId) {
      setConversationIdState(options.conversationId);
    }

    setSending(true);
    setSendError(null);

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: targetConversationId,
      sender_id: userId,
      text: options.text,
      image_url: options.imageUrl,
      audio_url: options.audioUrl,
      created_at: new Date().toISOString(),
      message_type: options.messageType,
      metadata: options.metadata,
      reply_to_id: options.replyToId,
      reply_to_text: options.replyToText,
    };

    setMessages((current) => mergeMessages([...current, optimisticMessage]));
    addMessageToCache(targetConversationId, optimisticMessage);

    try {
      const saved = await sendChatMessage({
        conversationId: targetConversationId,
        senderId: userId,
        text: options.text,
        imageUrl: options.imageUrl,
        audioUrl: options.audioUrl,
        videoUrl: options.videoUrl,
        messageType: options.messageType,
        metadata: options.metadata,
        replyToId: options.replyToId,
        replyToText: options.replyToText,
      });

      if (saved) {
        setMessages((current) => {
          const filtered = current.filter((msg) => msg.id !== optimisticId);
          return mergeMessages([...filtered, saved]);
        });
        addMessageToCache(targetConversationId, saved);
        await updateConversationLastMessageTime(targetConversationId, saved.created_at);
        return saved;
      }

      setMessages((current) => current.filter((msg) => msg.id !== optimisticId));
      setSendError("Unable to send message. Please try again.");
      return null;
    } catch (error) {
      console.error("useConversationMessages sendMessage error", error);
      setMessages((current) => current.filter((msg) => msg.id !== optimisticId));
      setSendError("Unable to send message. Please try again.");
      return null;
    } finally {
      if (isMountedRef.current) {
        setSending(false);
      }
    }
  }, [addMessageToCache, conversationId, userId]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.unsubscribe();
        } catch (err) {
          console.warn("useConversationMessages subscription cleanup failed", err);
        }
        subscriptionRef.current = null;
      }
      activeConversationIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!recipientId || !userId) {
      setConversationIdState(null);
      setMessages([]);
      setHasMore(false);
      return;
    }

    void resolveConversation();
  }, [recipientId, resolveConversation, userId]);

  useEffect(() => {
    if (!conversationId) return;
    subscribe(conversationId);
    void loadMessages(conversationId);
  }, [conversationId, loadMessages, subscribe]);

  return {
    conversationId,
    messages,
    setMessages,
    loading,
    loadingMore,
    sending,
    sendError,
    hasMore,
    loadMore,
    sendMessage,
    setConversationId: setConversationIdState,
  };
}
