import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ArrowLeft, Menu, Plus, Send, X } from "lucide-react-native";
import Markdown, { type RenderRules } from "react-native-markdown-display";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatDisplayDate } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import {
  areNativeProtectedRequestsDeferred,
  canMakeNativeProtectedRequest,
  NATIVE_OFFLINE_MESSAGE,
  reportNativeAuthRejection,
  reportNativeNetworkRequestFailure,
  reportNativeNetworkRequestSuccess,
} from "../lib/networkStatus";
import { nativeSupabase, nativeSupabaseAnonKey, nativeSupabaseUrl } from "../lib/supabase";
import {
  mergeCompletedWizrdMessages,
  sortWizrdMessages,
  streamWizrdChat,
  type WizrdStreamMessage,
} from "../lib/wizrdStreaming";
import {
  canCopyWizrdMessage,
} from "../lib/wizrdCopy";
import NativeGlassSurface from "./NativeGlassSurface";
import NativeHoldToConfirmDialog from "./NativeHoldToConfirmDialog";
import { createNativeWizrdCodeBlockRenderer } from "./NativeWizrdCodeBlock";
import WizrdCopyButton from "./WizrdCopyButton";

const WIZRD_ICON = require("../../assets/wizrd-icon.png");

type WizrdMessage = WizrdStreamMessage & {
  isStreaming?: boolean;
  isIncomplete?: boolean;
};

type WizrdConversation = {
  id: string;
  updatedAt: string;
  title: string;
  preview: string;
};

type ConversationActionMode = "menu" | "rename" | "delete" | null;

type InterruptedRequest = {
  message: string;
  knownMessageIds: Set<string>;
};

const SUGGESTED_QUESTIONS = [
  "Help me plan my day",
  "How can I make a good first impression?",
  "Give me a little motivation",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readHistoryMessage(value: unknown): WizrdMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.role !== "user" && value.role !== "assistant") ||
    typeof value.content !== "string" ||
    typeof value.created_at !== "string"
  ) {
    throw new Error("WiZrd conversation history contains an invalid message.");
  }
  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: value.created_at,
  };
}

async function getWizrdAccessToken(userId: string) {
  if (!canMakeNativeProtectedRequest()) {
    if (areNativeProtectedRequestsDeferred()) throw new Error(NATIVE_OFFLINE_MESSAGE);
    throw new Error("Sign in to chat with WiZrd.");
  }

  const { data, error } = await nativeSupabase.auth.getSession();
  if (error) throw error;
  let session = data.session;
  if (!session || session.user.id !== userId) throw new Error("Your session expired. Sign in again to continue.");

  if (session.expires_at && session.expires_at * 1000 <= Date.now() + 60_000) {
    const refreshed = await nativeSupabase.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    session = refreshed.data.session;
    if (!session || session.user.id !== userId) {
      throw new Error("Your session expired. Sign in again to continue.");
    }
  }
  return session.access_token;
}

export default function NativeWizrdChatScreen() {
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(windowWidth * 0.86, 360);
  const { session, loading: authLoading } = useNativeAuth();
  const { theme } = useNativeTheme();
  const colors = NATIVE_THEME_COLORS[theme];
  const isLiquidGlass = theme === "liquidGlass";
  const errorColor = theme === "white" ? "#be123c" : "#fda4af";
  const userId = session?.user.id;
  const listRef = useRef<FlatList<WizrdMessage>>(null);
  const historyRequestRef = useRef(0);
  const conversationListRequestRef = useRef(0);
  const suppressConversationPressRef = useRef<string | null>(null);
  const suppressConversationPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawerTranslateX = useRef(new Animated.Value(-drawerWidth)).current;
  const sendingRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WizrdMessage[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [conversationList, setConversationList] = useState<WizrdConversation[]>([]);
  const [loadingConversationList, setLoadingConversationList] = useState(false);
  const [conversationListError, setConversationListError] = useState<string | null>(null);
  const [conversationActionMode, setConversationActionMode] = useState<ConversationActionMode>(null);
  const [actionConversation, setActionConversation] = useState<WizrdConversation | null>(null);
  const [conversationTitleDraft, setConversationTitleDraft] = useState("");
  const [conversationActionBusy, setConversationActionBusy] = useState(false);
  const [conversationActionError, setConversationActionError] = useState<string | null>(null);
  const [needsHistoryRecovery, setNeedsHistoryRecovery] = useState(false);
  const interruptedRequestRef = useRef<InterruptedRequest | null>(null);

  useEffect(() => {
    if (!drawerVisible) drawerTranslateX.setValue(-drawerWidth);
  }, [drawerTranslateX, drawerVisible, drawerWidth]);

  const scheduleAutoScroll = useCallback(() => {
    if (!shouldAutoScrollRef.current || scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      if (shouldAutoScrollRef.current) listRef.current?.scrollToEnd({ animated: false });
    });
  }, []);

  const loadConversation = useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    setConversationId(null);
    setMessages([]);
    if (!userId) {
      setLoadingHistory(false);
      setError(authLoading ? null : "Sign in to chat with WiZrd.");
      return;
    }

    setLoadingHistory(true);
    setError(null);
    try {
      const { data: conversation, error: conversationError } = await nativeSupabase
        .from("wizrd_conversations")
        .select("id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (conversationError) throw conversationError;
      if (requestId !== historyRequestRef.current) return;

      if (!conversation) {
        setConversationId(null);
        setMessages([]);
        setNeedsHistoryRecovery(false);
        const interruptedRequest = interruptedRequestRef.current;
        if (interruptedRequest) setInput((current) => current || interruptedRequest.message);
        interruptedRequestRef.current = null;
        return;
      }
      if (typeof conversation.id !== "string") {
        throw new Error("WiZrd conversation history contains an invalid conversation.");
      }

      setConversationId(conversation.id);
      const { data: history, error: messagesError } = await nativeSupabase
        .from("wizrd_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });
      if (messagesError) throw messagesError;
      if (requestId !== historyRequestRef.current) return;

      const restoredMessages = (history ?? []).map(readHistoryMessage);
      const interruptedRequest = interruptedRequestRef.current;
      if (interruptedRequest) {
        const requestWasPersisted = restoredMessages.some((message) =>
          message.role === "user" &&
          message.content === interruptedRequest.message &&
          !interruptedRequest.knownMessageIds.has(message.id),
        );
        if (!requestWasPersisted) {
          setInput((current) => current || interruptedRequest.message);
        }
        interruptedRequestRef.current = null;
      }
      setMessages(sortWizrdMessages(restoredMessages));
      setNeedsHistoryRecovery(false);
    } catch (cause) {
      if (requestId !== historyRequestRef.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load WiZrd conversation history.");
    } finally {
      if (requestId === historyRequestRef.current) setLoadingHistory(false);
    }
  }, [authLoading, userId]);

  const loadConversationList = useCallback(async () => {
    const requestId = ++conversationListRequestRef.current;
    if (!userId) {
      setConversationList([]);
      setLoadingConversationList(false);
      setConversationListError(authLoading ? null : "Sign in to view your WiZrd history.");
      return;
    }

    setLoadingConversationList(true);
    setConversationListError(null);
    try {
      const { data: conversations, error: conversationsError } = await nativeSupabase
        .from("wizrd_conversations")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (conversationsError) throw conversationsError;
      if (requestId !== conversationListRequestRef.current) return;

      const validConversations = (conversations ?? []).filter(
        (conversation): conversation is { id: string; title: string | null; updated_at: string } =>
          typeof conversation.id === "string" &&
          (typeof conversation.title === "string" || conversation.title === null) &&
          typeof conversation.updated_at === "string",
      );
      if (validConversations.length === 0) {
        setConversationList([]);
        return;
      }

      const conversationIds = validConversations.map((conversation) => conversation.id);
      const { data: history, error: historyError } = await nativeSupabase
        .from("wizrd_messages")
        .select("conversation_id, role, content, created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (historyError) throw historyError;
      if (requestId !== conversationListRequestRef.current) return;

      const latestByConversation = new Map<string, { role: string; content: string }>();
      const latestUserByConversation = new Map<string, string>();
      for (const message of history ?? []) {
        if (
          typeof message.conversation_id !== "string" ||
          typeof message.content !== "string" ||
          typeof message.role !== "string"
        ) {
          continue;
        }
        if (!latestByConversation.has(message.conversation_id)) {
          latestByConversation.set(message.conversation_id, {
            role: message.role,
            content: message.content,
          });
        }
        if (message.role === "user" && !latestUserByConversation.has(message.conversation_id)) {
          latestUserByConversation.set(message.conversation_id, message.content);
        }
      }

      setConversationList(validConversations.map((conversation) => {
        const latest = latestByConversation.get(conversation.id);
        return {
          id: conversation.id,
          updatedAt: conversation.updated_at,
          title: conversation.title?.trim() || latestUserByConversation.get(conversation.id) || "New conversation",
          preview: latest
            ? `${latest.role === "user" ? "You" : "WiZrd"}: ${latest.content}`
            : "No messages yet",
        };
      }));
    } catch (cause) {
      if (requestId !== conversationListRequestRef.current) return;
      setConversationListError(cause instanceof Error ? cause.message : "Could not load WiZrd chat history.");
    } finally {
      if (requestId === conversationListRequestRef.current) setLoadingConversationList(false);
    }
  }, [authLoading, userId]);

  const openConversationDrawer = () => {
    drawerTranslateX.setValue(-drawerWidth);
    setDrawerVisible(true);
    void loadConversationList();
    requestAnimationFrame(() => {
      Animated.spring(drawerTranslateX, {
        toValue: 0,
        damping: 24,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    });
  };

  const closeConversationDrawer = () => {
    conversationListRequestRef.current += 1;
    Animated.timing(drawerTranslateX, {
      toValue: -drawerWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setDrawerVisible(false);
    });
  };

  const closeConversationActions = () => {
    if (conversationActionBusy) return;
    setConversationActionMode(null);
    setActionConversation(null);
    setConversationActionError(null);
  };

  const openConversationActions = (conversation: WizrdConversation) => {
    if (sending) return;
    if (suppressConversationPressTimerRef.current !== null) {
      clearTimeout(suppressConversationPressTimerRef.current);
    }
    suppressConversationPressRef.current = conversation.id;
    suppressConversationPressTimerRef.current = null;
    setActionConversation(conversation);
    setConversationTitleDraft(conversation.title);
    setConversationActionError(null);
    setConversationActionMode("menu");
  };

  const handleConversationPress = (selectedConversationId: string) => {
    if (suppressConversationPressRef.current === selectedConversationId) {
      suppressConversationPressRef.current = null;
      if (suppressConversationPressTimerRef.current !== null) {
        clearTimeout(suppressConversationPressTimerRef.current);
        suppressConversationPressTimerRef.current = null;
      }
      return;
    }
    void openSavedConversation(selectedConversationId);
  };

  const handleConversationPressOut = (selectedConversationId: string) => {
    if (suppressConversationPressRef.current !== selectedConversationId) return;
    if (suppressConversationPressTimerRef.current !== null) {
      clearTimeout(suppressConversationPressTimerRef.current);
    }
    suppressConversationPressTimerRef.current = setTimeout(() => {
      suppressConversationPressRef.current = null;
      suppressConversationPressTimerRef.current = null;
    }, 800);
  };

  const saveConversationTitle = async () => {
    const title = conversationTitleDraft.trim();
    if (!title) {
      setConversationActionError("A conversation title cannot be empty.");
      return;
    }
    if (!actionConversation || !userId) {
      setConversationActionError("Sign in to edit this conversation.");
      return;
    }

    setConversationActionBusy(true);
    setConversationActionError(null);
    try {
      const { data, error: updateError } = await nativeSupabase
        .from("wizrd_conversations")
        .update({ title })
        .eq("id", actionConversation.id)
        .eq("user_id", userId)
        .select("id, title")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error("This conversation could not be updated.");

      setConversationList((current) =>
        current.map((conversation) =>
          conversation.id === actionConversation.id
            ? { ...conversation, title: data.title }
            : conversation
        )
      );
      setActionConversation(null);
      setConversationActionMode(null);
    } catch (cause) {
      setConversationActionError(
        cause instanceof Error ? cause.message : "Could not update this conversation.",
      );
    } finally {
      setConversationActionBusy(false);
    }
  };

  const deleteConversation = async () => {
    if (!actionConversation || !userId) {
      setConversationActionError("Sign in to delete this conversation.");
      return;
    }

    setConversationActionBusy(true);
    setConversationActionError(null);
    try {
      const { data, error: deleteError } = await nativeSupabase
        .from("wizrd_conversations")
        .delete()
        .eq("id", actionConversation.id)
        .eq("user_id", userId)
        .select("id")
        .maybeSingle();
      if (deleteError) throw deleteError;
      if (!data) throw new Error("This conversation could not be deleted.");

      setConversationList((current) =>
        current.filter((conversation) => conversation.id !== actionConversation.id)
      );
      const deletedCurrentConversation = actionConversation.id === conversationId;
      setConversationActionMode(null);
      setActionConversation(null);
      if (deletedCurrentConversation) startNewConversation();
    } catch (cause) {
      setConversationActionError(
        cause instanceof Error ? cause.message : "Could not delete this conversation.",
      );
    } finally {
      setConversationActionBusy(false);
    }
  };

  const openSavedConversation = async (selectedConversationId: string) => {
    const requestId = ++historyRequestRef.current;
    setConversationId(selectedConversationId);
    setMessages([]);
    setInput("");
    setError(null);
    interruptedRequestRef.current = null;
    setLoadingHistory(true);
    closeConversationDrawer();

    try {
      const { data: history, error: historyError } = await nativeSupabase
        .from("wizrd_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", selectedConversationId)
        .order("created_at", { ascending: true });
      if (historyError) throw historyError;
      if (requestId !== historyRequestRef.current) return;
      setMessages(sortWizrdMessages((history ?? []).map(readHistoryMessage)));
      setNeedsHistoryRecovery(false);
    } catch (cause) {
      if (requestId !== historyRequestRef.current) return;
      setError(cause instanceof Error ? cause.message : "Could not load this WiZrd conversation.");
    } finally {
      if (requestId === historyRequestRef.current) setLoadingHistory(false);
    }
  };

  const retryConversationLoad = () => {
    if (needsHistoryRecovery) void loadConversation();
    else if (conversationId) void openSavedConversation(conversationId);
    else void loadConversation();
  };

  useEffect(() => {
    void loadConversation();
    return () => {
      historyRequestRef.current += 1;
    };
  }, [loadConversation]);

  useEffect(() => () => {
    streamAbortRef.current?.abort();
    if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current);
    if (suppressConversationPressTimerRef.current !== null) {
      clearTimeout(suppressConversationPressTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!loadingHistory) scheduleAutoScroll();
  }, [loadingHistory, messages.length, scheduleAutoScroll]);

  const startNewConversation = () => {
    historyRequestRef.current += 1;
    setConversationId(null);
    setMessages([]);
    setInput("");
    setError(null);
    setNeedsHistoryRecovery(false);
    interruptedRequestRef.current = null;
    setSending(false);
    setLoadingHistory(false);
    if (drawerVisible) closeConversationDrawer();
  };

  const sendMessage = async (messageToSend = input.trim()) => {
    if (!messageToSend || sendingRef.current || loadingHistory || needsHistoryRecovery || !userId) return;
    sendingRef.current = true;
    setSending(true);
    setError(null);
    setNeedsHistoryRecovery(false);
    setInput("");
    const optimisticMessage: WizrdMessage = {
      id: `pending-user-${Date.now()}`,
      role: "user",
      content: messageToSend,
      createdAt: new Date().toISOString(),
    };
    const knownMessageIds = new Set(messages
      .filter((item) => !item.id.startsWith("pending-") && !item.id.startsWith("stream-"))
      .map((item) => item.id));
    const streamMessageId = `stream-assistant-${Date.now()}`;
    setMessages((current) => [
      ...current,
      optimisticMessage,
      {
        id: streamMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        isStreaming: true,
      },
    ]);
    shouldAutoScrollRef.current = true;
    const controller = new AbortController();
    streamAbortRef.current = controller;

    try {
      const accessToken = await getWizrdAccessToken(userId);
      const response = await streamWizrdChat({
        endpoint: `${nativeSupabaseUrl.replace(/\/+$/, "")}/functions/v1/wizrd-chat`,
        anonKey: nativeSupabaseAnonKey,
        accessToken,
        conversationId,
        message: messageToSend,
        signal: controller.signal,
        onUnauthorized: reportNativeAuthRejection,
        onConnected: reportNativeNetworkRequestSuccess,
        onConnectionError: () => reportNativeNetworkRequestFailure(new Error("Network request failed")),
        onText: (chunk) => {
          setMessages((current) => current.map((item) =>
            item.id === streamMessageId
              ? { ...item, content: item.content + chunk }
              : item,
          ));
          scheduleAutoScroll();
        },
      });
      setConversationId(response.conversationId);
      setMessages((current) => mergeCompletedWizrdMessages(
        current,
        [optimisticMessage.id, streamMessageId],
        response,
      ));
      setNeedsHistoryRecovery(false);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const failureMessage = cause instanceof Error ? cause.message : "WiZrd could not complete this response.";
      setMessages((current) => current.flatMap((item) => {
        if (item.id !== streamMessageId) return [item];
        return item.content
          ? [{ ...item, isStreaming: false, isIncomplete: true }]
          : [];
      }));
      interruptedRequestRef.current = { message: messageToSend, knownMessageIds };
      setNeedsHistoryRecovery(true);
      setError(`${failureMessage} Reload saved chat history before retrying.`);
    } finally {
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      sendingRef.current = false;
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: WizrdMessage }) => {
    const mine = item.role === "user";
    const showCopyActions = canCopyWizrdMessage(item);
    const renderCodeBlock = createNativeWizrdCodeBlockRenderer(colors);
    const markdownRules: RenderRules | undefined = showCopyActions
      ? { fence: renderCodeBlock, code_block: renderCodeBlock }
      : undefined;
    return (
      <View style={[styles.messageRow, mine && styles.userMessageRow]}>
        <View
          style={[
            styles.messageBubble,
            mine ? styles.userMessageBubble : styles.assistantMessageBubble,
            {
              backgroundColor: mine ? "#4f46e5" : colors.surface,
              borderColor: mine ? "rgba(255,255,255,0.2)" : colors.border,
            },
          ]}
        >
          {item.content ? (
            mine ? (
              <Text style={[styles.messageText, { color: "#ffffff" }]}>{item.content}</Text>
            ) : (
              <Markdown rules={markdownRules} style={{
                body: { color: colors.text, fontSize: 14, lineHeight: 21 },
                text: { color: colors.text },
                paragraph: { color: colors.text, marginTop: 0, marginBottom: 7, fontSize: 14, lineHeight: 21 },
                heading1: { color: colors.text, fontSize: 21, fontWeight: "900", marginTop: 5, marginBottom: 7 },
                heading2: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 5, marginBottom: 6 },
                heading3: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 4, marginBottom: 5 },
                bullet_list: { marginTop: 2, marginBottom: 7 },
                ordered_list: { marginTop: 2, marginBottom: 7 },
                list_item: { marginVertical: 2 },
                code_inline: { color: colors.text, backgroundColor: colors.control, borderRadius: 4 },
                code_block: { color: colors.text, backgroundColor: colors.control, borderRadius: 8, padding: 8 },
                fence: { color: colors.text, backgroundColor: colors.control, borderRadius: 8, padding: 8 },
                blockquote: { borderLeftColor: "#8b5cf6", borderLeftWidth: 3, paddingLeft: 9, opacity: 0.9 },
                link: { color: "#93c5fd", textDecorationLine: "underline" },
                strong: { color: colors.text, fontWeight: "900" },
                em: { color: colors.text, fontStyle: "italic" },
                hr: { backgroundColor: colors.border },
              }}>
                {item.content}
              </Markdown>
            )
          ) : item.isStreaming ? (
            <View accessibilityLabel="WiZrd is typing" style={styles.bubbleTyping}>
              <ActivityIndicator color="#8b5cf6" size="small" />
              <Text style={[styles.typingText, { color: colors.muted }]}>Thinking…</Text>
            </View>
          ) : null}
          {item.isIncomplete ? (
            <Text style={[styles.incompleteText, { color: errorColor }]}>
              Response interrupted. Reload saved chat to check what was received.
            </Text>
          ) : null}
          {showCopyActions ? (
            <WizrdCopyButton
              color={colors.muted}
              content={item.content}
              kind="message"
              mutedColor={colors.muted}
            />
          ) : null}
        </View>
      </View>
    );
  };

  const listEmpty = (
    <View style={styles.welcome}>
      <Image accessibilityLabel="WiZrd icon" source={WIZRD_ICON} style={styles.welcomeIcon} />
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>Hi, I’m WiZrd</Text>
      <Text style={[styles.welcomeCopy, { color: colors.muted }]}>
        Your thoughtful sidekick for ideas, everyday questions, and a little inspiration.
      </Text>
      <View style={styles.suggestions}>
        {SUGGESTED_QUESTIONS.map((question) => (
          <Pressable
            accessibilityRole="button"
            key={question}
            onPress={() => void sendMessage(question)}
            style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.suggestionText, { color: colors.text }]}>{question}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <LinearGradient colors={colors.background} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
          style={styles.keyboard}
        >
          <NativeGlassSurface
            enabled={isLiquidGlass}
            style={[
              styles.header,
              { backgroundColor: isLiquidGlass ? "transparent" : colors.surface, borderBottomColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityLabel="Back to messages"
              accessibilityRole="button"
              onPress={() => router.canGoBack() ? router.back() : router.replace("/messages")}
              style={[styles.headerButton, { backgroundColor: colors.control, borderColor: colors.border }]}
            >
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
            <Image accessibilityLabel="WiZrd icon" source={WIZRD_ICON} style={styles.headerIcon} />
            <View style={styles.headerCopy}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>WiZrd</Text>
              <Text style={[styles.headerSubtitle, { color: colors.muted }]}>Your AI sidekick</Text>
            </View>
            <Pressable
              accessibilityLabel="Open WiZrd chat menu"
              accessibilityRole="button"
              accessibilityState={{ disabled: sending }}
              disabled={sending}
              onPress={openConversationDrawer}
              style={[styles.headerButton, { backgroundColor: colors.control, borderColor: colors.border }, sending && styles.disabledSendButton]}
            >
              <Menu color={colors.text} size={21} />
            </Pressable>
          </NativeGlassSurface>

          {error ? (
            <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
              <Pressable
                accessibilityRole="button"
                disabled={sending}
                onPress={retryConversationLoad}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>{needsHistoryRecovery ? "Reload saved chat" : "Try again"}</Text>
              </Pressable>
            </View>
          ) : null}

          {loadingHistory ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#8b5cf6" size="large" />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Loading your conversation…</Text>
            </View>
          ) : (
            <FlatList
              contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyMessageList]}
              data={messages}
              keyboardShouldPersistTaps="handled"
              keyExtractor={(item) => item.id}
              ListEmptyComponent={listEmpty}
              onContentSizeChange={scheduleAutoScroll}
              onScroll={(event) => {
                const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
                shouldAutoScrollRef.current =
                  contentOffset.y + layoutMeasurement.height >= contentSize.height - 96;
              }}
              ref={listRef}
              renderItem={renderMessage}
              scrollEventThrottle={100}
              showsVerticalScrollIndicator={false}
            />
          )}

          <NativeGlassSurface
            enabled={isLiquidGlass}
            style={[
              styles.composer,
              { backgroundColor: isLiquidGlass ? "transparent" : colors.surface, borderTopColor: colors.border },
            ]}
          >
            {sending ? (
              <View accessibilityLabel="WiZrd is typing" style={styles.typingIndicator}>
                <ActivityIndicator color="#8b5cf6" size="small" />
                <Text style={[styles.typingText, { color: colors.muted }]}>WiZrd is thinking…</Text>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <TextInput
                accessibilityLabel="Message WiZrd"
                editable={!sending && !loadingHistory && !needsHistoryRecovery && Boolean(userId)}
                multiline
                onChangeText={setInput}
                onSubmitEditing={() => void sendMessage()}
                placeholder="Ask WiZrd anything…"
                placeholderTextColor={colors.muted}
                returnKeyType="send"
                style={[styles.input, { backgroundColor: colors.control, borderColor: colors.border, color: colors.text }]}
                value={input}
              />
              <Pressable
                accessibilityLabel="Send message"
                accessibilityRole="button"
                disabled={!input.trim() || sending || loadingHistory || needsHistoryRecovery || !userId}
                onPress={() => void sendMessage()}
                style={[styles.sendButton, (!input.trim() || sending || loadingHistory || needsHistoryRecovery || !userId) && styles.disabledSendButton]}
              >
                <Send color="#ffffff" size={19} strokeWidth={2.5} />
              </Pressable>
            </View>
          </NativeGlassSurface>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        animationType="none"
        onRequestClose={closeConversationDrawer}
        statusBarTranslucent
        transparent
        visible={drawerVisible}
      >
        <View style={styles.drawerOverlay}>
          <Pressable
            accessibilityLabel="Close chat history"
            accessibilityRole="button"
            onPress={closeConversationDrawer}
            style={styles.drawerScrim}
          />
          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                backgroundColor: colors.surface,
                borderRightColor: colors.border,
                transform: [{ translateX: drawerTranslateX }],
              },
            ]}
          >
            <SafeAreaView edges={["top", "bottom"]} style={styles.drawerSafeArea}>
              <View style={[styles.drawerHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.drawerHeading}>
                  <Text style={[styles.drawerTitle, { color: colors.text }]}>Your conversations</Text>
                  <Text style={[styles.drawerSubtitle, { color: colors.muted }]}>Pick up where you left off</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close chat history"
                  accessibilityRole="button"
                  onPress={closeConversationDrawer}
                  style={[styles.drawerCloseButton, { backgroundColor: colors.control }]}
                >
                  <X color={colors.text} size={19} />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: sending }}
                disabled={sending}
                onPress={startNewConversation}
                style={[styles.newConversationButton, sending && styles.disabledSendButton]}
              >
                <Plus color="#ffffff" size={19} strokeWidth={2.5} />
                <Text style={styles.newConversationText}>New conversation</Text>
              </Pressable>
              <Text style={[styles.historyLabel, { color: colors.muted }]}>RECENT</Text>
              {loadingConversationList ? (
                <View style={styles.drawerState}>
                  <ActivityIndicator color="#8b5cf6" />
                  <Text style={[styles.drawerStateText, { color: colors.muted }]}>Loading history…</Text>
                </View>
              ) : conversationListError ? (
                <View style={styles.drawerState}>
                  <Text accessibilityRole="alert" style={[styles.errorText, { color: errorColor }]}>{conversationListError}</Text>
                  <Pressable onPress={() => void loadConversationList()} style={styles.drawerRetry}>
                    <Text style={styles.drawerRetryText}>Try again</Text>
                  </Pressable>
                </View>
              ) : conversationList.length === 0 ? (
                <View style={styles.drawerState}>
                  <Text style={[styles.drawerStateText, { color: colors.muted }]}>Your saved chats will show up here.</Text>
                </View>
              ) : (
                <FlatList
                  contentContainerStyle={styles.conversationList}
                  data={conversationList}
                  keyExtractor={(item) => item.id}
                  style={styles.conversationListView}
                  renderItem={({ item }) => {
                    const selected = item.id === conversationId;
                    return (
                      <Pressable
                        accessibilityLabel={`Open conversation: ${item.title}`}
                        accessibilityHint="Press and hold for options to rename or delete this conversation."
                        accessibilityRole="button"
                        delayLongPress={450}
                        onLongPress={() => openConversationActions(item)}
                        onPress={() => handleConversationPress(item.id)}
                        onPressOut={() => handleConversationPressOut(item.id)}
                        style={[
                          styles.conversationItem,
                          {
                            backgroundColor: selected ? colors.raised : "transparent",
                            borderColor: selected ? colors.border : "transparent",
                          },
                        ]}
                      >
                        <Text numberOfLines={1} style={[styles.conversationTitle, { color: colors.text }]}>
                          {item.title}
                        </Text>
                        <Text numberOfLines={2} style={[styles.conversationPreview, { color: colors.muted }]}>
                          {item.preview}
                        </Text>
                        <Text style={[styles.conversationDate, { color: colors.muted }]}>
                          {formatDisplayDate(item.updatedAt)}
                        </Text>
                      </Pressable>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={closeConversationActions}
        statusBarTranslucent
        transparent
        visible={conversationActionMode !== null && conversationActionMode !== "delete"}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.conversationActionOverlay}
        >
          <Pressable
            accessibilityLabel="Close conversation options"
            disabled={conversationActionBusy}
            onPress={closeConversationActions}
            style={StyleSheet.absoluteFill}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.conversationActionDialog,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.conversationActionTitle, { color: colors.text }]}>
              {conversationActionMode === "menu"
                ? "Conversation options"
                : conversationActionMode === "rename"
                ? "Rename conversation"
                : "Delete conversation?"}
            </Text>
            {actionConversation ? (
              <Text
                numberOfLines={2}
                style={[styles.conversationActionSubtitle, { color: colors.muted }]}
              >
                {actionConversation.title}
              </Text>
            ) : null}
            {conversationActionMode === "menu" ? (
              <View style={styles.conversationActionOptions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setConversationTitleDraft(actionConversation?.title ?? "");
                    setConversationActionError(null);
                    setConversationActionMode("rename");
                  }}
                  style={[styles.conversationActionOption, { backgroundColor: colors.control }]}
                >
                  <Text style={[styles.conversationActionOptionText, { color: colors.text }]}>
                    Edit title
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setConversationActionError(null);
                    setConversationActionMode("delete");
                  }}
                  style={[styles.conversationActionOption, { backgroundColor: colors.control }, styles.deleteConversationOption]}
                >
                  <Text style={styles.deleteActionText}>Delete conversation</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={closeConversationActions}
                  style={styles.conversationActionCancel}
                >
                  <Text style={[styles.conversationActionCancelText, { color: colors.muted }]}>
                    Cancel
                  </Text>
                </Pressable>
              </View>
            ) : conversationActionMode === "rename" ? (
              <>
                <TextInput
                  accessibilityLabel="Conversation title"
                  autoCapitalize="sentences"
                  autoFocus
                  editable={!conversationActionBusy}
                  maxLength={80}
                  onChangeText={setConversationTitleDraft}
                  onSubmitEditing={() => void saveConversationTitle()}
                  placeholder="Conversation title"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={[
                    styles.conversationTitleInput,
                    { backgroundColor: colors.control, borderColor: colors.border, color: colors.text },
                  ]}
                  value={conversationTitleDraft}
                />
                {conversationActionError ? (
                  <Text accessibilityRole="alert" style={styles.conversationActionError}>
                    {conversationActionError}
                  </Text>
                ) : null}
                <View style={styles.conversationActionButtons}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={conversationActionBusy}
                    onPress={closeConversationActions}
                    style={[styles.conversationActionButton, { backgroundColor: colors.control }]}
                  >
                    <Text style={[styles.conversationActionButtonText, { color: colors.text }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={conversationActionBusy || !conversationTitleDraft.trim()}
                    onPress={() => void saveConversationTitle()}
                    style={[styles.conversationActionButton, styles.saveTitleButton]}
                  >
                    {conversationActionBusy
                      ? <ActivityIndicator color="#ffffff" size="small" />
                      : <Text style={styles.saveTitleButtonText}>Save</Text>}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <NativeHoldToConfirmDialog
        busy={conversationActionBusy}
        errorMessage={conversationActionError}
        onCancel={closeConversationActions}
        onConfirm={() => void deleteConversation()}
        visible={conversationActionMode === "delete"}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 14, borderBottomWidth: 1 },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 15 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: "rgba(255,255,255,0.65)" },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: "900", letterSpacing: 0.1 },
  headerSubtitle: { fontSize: 11, fontWeight: "600" },
  errorBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginHorizontal: 14, marginTop: 10, padding: 11, borderWidth: 1, borderRadius: 16 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  retryButton: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 11, borderRadius: 12, backgroundColor: "#5140ba" },
  retryText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 13 },
  messageList: { flexGrow: 1, justifyContent: "flex-end", gap: 12, paddingHorizontal: 14, paddingTop: 20, paddingBottom: 20 },
  emptyMessageList: { justifyContent: "center" },
  welcome: { alignItems: "center", alignSelf: "center", width: "100%", maxWidth: 420, paddingHorizontal: 12, paddingVertical: 24 },
  welcomeIcon: { width: 64, height: 64, marginBottom: 18, borderRadius: 32, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.65)" },
  welcomeTitle: { marginBottom: 8, fontSize: 25, fontWeight: "900", letterSpacing: -0.5 },
  welcomeCopy: { maxWidth: 310, fontSize: 14, lineHeight: 21, textAlign: "center" },
  suggestions: { width: "100%", gap: 9, marginTop: 24 },
  suggestion: { minHeight: 48, justifyContent: "center", paddingHorizontal: 15, paddingVertical: 11, borderWidth: 1, borderRadius: 17 },
  suggestionText: { fontSize: 13, fontWeight: "700" },
  messageRow: { maxWidth: "88%", flexDirection: "row", alignItems: "flex-end", gap: 7, alignSelf: "flex-start" },
  userMessageRow: { alignSelf: "flex-end" },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderRadius: 20 },
  userMessageBubble: { borderBottomRightRadius: 7 },
  assistantMessageBubble: { borderBottomLeftRadius: 7 },
  messageText: { fontSize: 14, lineHeight: 21 },
  bubbleTyping: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 20 },
  incompleteText: { marginTop: 8, fontSize: 11, lineHeight: 15 },
  composer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1 },
  typingIndicator: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 6, paddingBottom: 8 },
  typingText: { fontSize: 12, fontWeight: "600" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 9 },
  input: { flex: 1, minHeight: 48, maxHeight: 130, paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12, borderWidth: 1, borderRadius: 19, fontSize: 14, lineHeight: 20 },
  sendButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#5140d9" },
  disabledSendButton: { opacity: 0.45 },
  drawerOverlay: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.44)" },
  drawerScrim: { ...StyleSheet.absoluteFill },
  drawer: { height: "100%", borderRightWidth: 1, elevation: 18, shadowColor: "#000000", shadowOpacity: 0.32, shadowRadius: 24, shadowOffset: { width: 8, height: 0 } },
  drawerSafeArea: { flex: 1 },
  drawerHeader: { minHeight: 82, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 17, borderBottomWidth: 1 },
  drawerHeading: { flex: 1, gap: 4 },
  drawerTitle: { fontSize: 17, fontWeight: "900" },
  drawerSubtitle: { fontSize: 12 },
  drawerCloseButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 13 },
  newConversationButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginHorizontal: 14, marginTop: 16, borderRadius: 15, backgroundColor: "#5140d9" },
  newConversationText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  historyLabel: { marginHorizontal: 18, marginTop: 23, marginBottom: 9, fontSize: 10, fontWeight: "900", letterSpacing: 1.4 },
  conversationList: { gap: 7, paddingHorizontal: 10, paddingBottom: 14 },
  conversationListView: { flex: 1, minHeight: 0 },
  conversationItem: { minHeight: 74, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderRadius: 14 },
  conversationTitle: { fontSize: 13, fontWeight: "800" },
  conversationPreview: { marginTop: 4, fontSize: 11, lineHeight: 15 },
  conversationDate: { marginTop: 5, fontSize: 10 },
  drawerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 22 },
  drawerStateText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  drawerRetry: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: "#5140ba" },
  drawerRetryText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  conversationActionOverlay: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 26, backgroundColor: "rgba(0,0,0,0.5)" },
  conversationActionDialog: { width: "100%", maxWidth: 380, maxHeight: "85%", padding: 20, borderWidth: 1, borderRadius: 24 },
  conversationActionTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  conversationActionSubtitle: { marginTop: 6, fontSize: 13, lineHeight: 18, textAlign: "center" },
  conversationActionOptions: { gap: 9, marginTop: 20 },
  conversationActionOption: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  conversationActionOptionText: { fontSize: 14, fontWeight: "800" },
  deleteActionText: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  deleteConversationOption: { borderWidth: 1, borderColor: "#f87171", backgroundColor: "#dc2626" },
  conversationActionCancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  conversationActionCancelText: { fontSize: 13, fontWeight: "700" },
  conversationTitleInput: { minHeight: 48, marginTop: 18, paddingHorizontal: 13, borderWidth: 1, borderRadius: 13, fontSize: 14 },
  conversationActionError: { marginTop: 10, color: "#e11d48", fontSize: 12, lineHeight: 17, textAlign: "center" },
  conversationActionButtons: { flexDirection: "row", gap: 10, marginTop: 18 },
  conversationActionButton: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  conversationActionButtonText: { fontSize: 13, fontWeight: "800" },
  saveTitleButton: { backgroundColor: "#5140d9" },
  saveTitleButtonText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
});
