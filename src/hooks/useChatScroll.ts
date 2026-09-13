import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "../lib/messageApi";

interface UseChatScrollOptions {
  conversationId: string | null;
  messages: Message[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
}

export function useChatScroll({
  conversationId,
  messages,
  hasMore,
  loadingMore,
  loadMore,
}: UseChatScrollOptions) {
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const previousConversationIdRef = useRef<string | null>(null);
  const scrollIdleTimeoutRef = useRef<number | null>(null);
  const searchBarVisibleRef = useRef(false);
  const hasMoreMessagesRef = useRef(hasMore);
  const isLoadingOlderMessagesRef = useRef(loadingMore);
  const newMessagesCountRef = useRef(0);

  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showSearchBar, setShowSearchBar] = useState(false);

  const incrementNewMessagesCount = useCallback(() => {
    if (!isUserAtBottomRef.current) {
      newMessagesCountRef.current += 1;
      setNewMessagesCount(newMessagesCountRef.current);
    }
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!conversationId || !messages.length || loadingMore || !hasMore) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.created_at) return;

    const previousHeight = messagesContainerRef.current?.scrollHeight;
    await loadMore();

    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container && previousHeight !== undefined) {
        const heightDelta = container.scrollHeight - previousHeight;
        container.scrollTop = heightDelta;
      }
    });
  }, [conversationId, hasMore, loadMore, loadingMore, messages]);

  useEffect(() => {
    hasMoreMessagesRef.current = hasMore;
    isLoadingOlderMessagesRef.current = loadingMore;
  }, [hasMore, loadingMore]);

  useEffect(() => {
    if (!conversationId || !messagesContainerRef.current || messages.length === 0) return;

    if (previousConversationIdRef.current !== conversationId) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
        isUserAtBottomRef.current = true;
        previousConversationIdRef.current = conversationId;
      });
    }
  }, [conversationId, messages.length]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      isUserAtBottomRef.current = isNearBottom;

      const shouldRevealSearch = container.scrollTop > 24;
      if (shouldRevealSearch && !searchBarVisibleRef.current) {
        searchBarVisibleRef.current = true;
        setShowSearchBar(true);
      } else if (!shouldRevealSearch && searchBarVisibleRef.current) {
        searchBarVisibleRef.current = false;
        setShowSearchBar(false);
      }

      if (scrollIdleTimeoutRef.current) {
        window.clearTimeout(scrollIdleTimeoutRef.current);
      }

      scrollIdleTimeoutRef.current = window.setTimeout(() => {
        if (!searchBarVisibleRef.current) {
          setShowSearchBar(false);
        }
      }, 1200);

      if (isNearBottom && newMessagesCountRef.current > 0) {
        newMessagesCountRef.current = 0;
        setNewMessagesCount(0);
      }

      if (container.scrollTop < 220 && !isNearBottom && hasMoreMessagesRef.current && !isLoadingOlderMessagesRef.current) {
        void loadOlderMessages();
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (scrollIdleTimeoutRef.current) {
        window.clearTimeout(scrollIdleTimeoutRef.current);
        scrollIdleTimeoutRef.current = null;
      }
    };
  }, [conversationId, loadOlderMessages]);

  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    const messageCountChanged = previousCount !== messages.length;
    previousMessageCountRef.current = messages.length;

    const shouldAutoScroll = messageCountChanged && previousCount !== 0 && isUserAtBottomRef.current && !isLoadingOlderMessagesRef.current;

    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages]);

  return {
    messagesEndRef,
    messagesContainerRef,
    isUserAtBottomRef,
    newMessagesCount,
    setNewMessagesCount,
    incrementNewMessagesCount,
    showSearchBar,
  };
}
