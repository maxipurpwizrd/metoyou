import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import Constants from "expo-constants";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioRecorderState,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Mic } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Message, MessageThread } from "../../types/message";
import { formatDisplayTime } from "../../lib/time";
import { useNativeAuth } from "../contexts/NativeAuthProvider";
import { NATIVE_THEME_COLORS, useNativeTheme } from "../contexts/NativeThemeProvider";
import { useNativeCalls } from "../contexts/NativeCallContext";
import { useNativePresence } from "../contexts/NativePresenceProvider";
import { fetchNativeVibesProStatus } from "../lib/profile";
import { nativeSupabase } from "../lib/supabase";
import {
  deleteNativeMessage,
  editNativeMessage,
  fetchNativeChatRecipient,
  fetchNativeConversationMessages,
  markNativeMessagesAsRead,
  type NativeChatAttachment,
  type NativeChatUpload,
  reactToNativeMessage,
  resolveNativeConversation,
  sendNativeMessage,
  subscribeToNativeMessages,
  uploadNativeChatAttachment,
  uploadNativeVoiceNote,
} from "../lib/chat";
import { fetchNativeMessageThreads } from "../lib/messages";
import { getPresenceLabel } from "../../lib/presenceStatus";

const EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "😍", "🤔", "😎", "🙏", "😢", "👏"];
const QUICK_REACTIONS = ["❤️", "😂", "🔥", "😭", "👍"];

type Recipient = {
  id: string;
  username: string;
  profile_pic: string | null;
};

function getReplyText(message: Message) {
  const metadata = message.metadata;
  return typeof metadata?.reply_to_text === "string"
    ? metadata.reply_to_text
    : message.reply_to_text ?? null;
}

function getMetadataText(message: Message, key: string) {
  const value = message.metadata?.[key];
  return typeof value === "string" ? value : null;
}

function NativeVoiceMessage({ uri, mine, isVibesPro }: { uri: string; mine: boolean; isVibesPro: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || 0;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const remaining = Math.max(0, Math.ceil(duration - status.currentTime));
  return (
    <View style={[styles.voicePlayer, mine && styles.mineVoicePlayer, isVibesPro && !mine && styles.premiumVoicePlayer]}>
      <Pressable
        accessibilityLabel={status.playing ? "Pause voice note" : "Play voice note"}
        accessibilityRole="button"
        onPress={() => (status.playing ? player.pause() : player.play())}
        style={[styles.voicePlayerButton, mine && styles.mineVoicePlayerButton]}
      >
        <Text style={[styles.voicePlayerGlyph, mine && styles.mineVoicePlayerGlyph]}>{status.playing ? "Ⅱ" : "▶"}</Text>
      </Pressable>
      <View accessibilityLabel="Voice note waveform" style={styles.playbackWaveform}>
        {Array.from({ length: 24 }, (_, index) => {
          const sample = 0.2 + Math.abs(Math.sin((index + 1) * 1.73) * Math.cos((index + 3) * 0.61)) * 0.8;
          const played = index / 24 <= progress;
          return (
            <View
              key={index}
              style={[
                styles.playbackWaveformBar,
                { height: 5 + sample * 20 },
                played && (mine ? styles.playedWaveformBarMine : styles.playedWaveformBar),
                isVibesPro && !mine && !played && styles.premiumPlaybackWaveformBar,
                isVibesPro && !mine && played && styles.premiumPlayedWaveformBar,
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.voicePlayerTime, mine && styles.mineVoicePlayerGlyph]}>
        {`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
      </Text>
    </View>
  );
}

function NativeVoicePreview({ uri, onRemove, isVibesPro }: { uri: string; onRemove: () => void; isVibesPro: boolean }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <View style={[styles.pendingMedia, isVibesPro && styles.premiumPendingMedia]}>
      <Pressable accessibilityLabel={status.playing ? "Pause voice note preview" : "Play voice note preview"} onPress={() => (status.playing ? player.pause() : player.play())} style={styles.previewPlay}>
        <Text style={styles.previewPlayGlyph}>{status.playing ? "Ⅱ" : "▶"}</Text>
      </Pressable>
      <Text style={[styles.pendingMediaName, isVibesPro && styles.premiumText]}>Voice note · {Math.floor(status.duration || 0)}s</Text>
      <Pressable accessibilityLabel="Remove voice note" onPress={onRemove} style={styles.cancelButton}>
        <Text style={styles.cancelText}>×</Text>
      </Pressable>
    </View>
  );
}

function RecordingWaveform({ samples, isVibesPro }: { samples: number[]; isVibesPro: boolean }) {
  return (
    <View accessibilityLabel="Live recording waveform" style={styles.waveform}>
      {samples.map((sample, index) => {
        const height = 4 + sample * 28;
        return (
          <View
            key={index}
            style={[
              styles.waveformBar,
              { height, opacity: 0.45 + sample * 0.55 },
              isVibesPro && styles.premiumWaveformBar,
            ]}
          />
        );
      })}
    </View>
  );
}

export default function NativeChatScreen() {
  const { recipientId: routeRecipientId } = useLocalSearchParams<{ recipientId: string | string[] }>();
  const recipientId = Array.isArray(routeRecipientId) ? routeRecipientId[0] : routeRecipientId;
  const router = useRouter();
  const { session, loading: authLoading } = useNativeAuth();
  const { theme } = useNativeTheme();
  const isBlueSky = theme === "bluesky";
  const { startCall } = useNativeCalls();
  const userId = session?.user.id;
  const recipientPresence = useNativePresence(recipientId);
  const listRef = useRef<FlatList<Message>>(null);
  const suppressAutoScrollRef = useRef(false);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder, 100);
  const recorderRef = useRef(recorder);
  const recordingRef = useRef(false);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingSecondsRef = useRef(0);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVibesPro, setIsVibesPro] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editTarget, setEditTarget] = useState<Message | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [forwardPickerVisible, setForwardPickerVisible] = useState(false);
  const [forwardThreads, setForwardThreads] = useState<MessageThread[]>([]);
  const [loadingForwardThreads, setLoadingForwardThreads] = useState(false);
  const [forwardingToId, setForwardingToId] = useState<string | null>(null);
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [attachment, setAttachment] = useState<NativeChatAttachment | null>(null);
  const [attachmentPickerVisible, setAttachmentPickerVisible] = useState(false);
  const [pendingVoiceUri, setPendingVoiceUri] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceRecordingPaused, setVoiceRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveformSamples, setWaveformSamples] = useState<number[]>(() => Array(25).fill(0.08));
  recorderRef.current = recorder;

  const clearRecordingTimers = useCallback(() => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = null;
  }, []);

  useEffect(() => {
    if (!isRecording || voiceRecordingPaused) return;
    const level = Math.max(0, Math.min(1, ((recorderState.metering ?? -60) + 60) / 60));
    setWaveformSamples((current) => [...current.slice(1), level]);
  }, [isRecording, recorderState.metering, voiceRecordingPaused]);

  const restorePlaybackAudioMode = useCallback(async () => {
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (cause) {
      console.error("Could not restore chat audio playback mode.", cause);
      setError((current) => current
        ? `${current} Audio playback settings could not be restored.`
        : "Audio playback settings could not be restored.");
    }
  }, []);

  const sendVoiceNote = useCallback(async (uri: string) => {
    if (!conversationId || !userId) {
      setError("The conversation is not ready to send a voice note.");
      setPendingVoiceUri(uri);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const audioUrl = await uploadNativeVoiceNote(uri, conversationId);
      const message = await sendNativeMessage(conversationId, userId, {
        text: input.trim() || undefined,
        replyTo: replyTo ?? undefined,
        upload: { audioUrl },
        messageType: "audio",
      });
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message].sort((left, right) => left.created_at.localeCompare(right.created_at)));
      setInput("");
      setReplyTo(null);
      setPendingVoiceUri(null);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setPendingVoiceUri(uri);
      setError(cause instanceof Error ? cause.message : "The voice note could not be sent.");
    } finally {
      setSending(false);
    }
  }, [conversationId, input, replyTo, userId]);

  const stopRecording = useCallback(async (sendImmediately = false) => {
    clearRecordingTimers();
    if (!recordingRef.current) return null;
    recordingRef.current = false;
    try {
      await recorderRef.current.stop();
      const uri = recorderRef.current.uri;
      if (!uri) throw new Error("The voice note could not be saved.");
      if (sendImmediately) {
        await sendVoiceNote(uri);
      } else {
        setPendingVoiceUri(uri);
      }
      return uri;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the voice note.");
      return null;
    } finally {
      setIsRecording(false);
      setVoiceRecordingPaused(false);
      await restorePlaybackAudioMode();
    }
  }, [clearRecordingTimers, restorePlaybackAudioMode, sendVoiceNote]);

  const startRecordingClock = useCallback(() => {
    if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    recordingIntervalRef.current = setInterval(() => {
      const seconds = recordingSecondsRef.current + 1;
      recordingSecondsRef.current = seconds;
      setRecordingSeconds(seconds);
      if (seconds >= 60) void stopRecording(true);
    }, 1000);
  }, [stopRecording]);

  const startRecording = useCallback(async () => {
    setError(null);
    setPendingVoiceUri(null);
    setAttachment(null);
    setEmojiPickerVisible(false);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Allow microphone access to record a voice note.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      setWaveformSamples(Array(25).fill(0.08));
      setIsRecording(true);
      setVoiceRecordingPaused(false);
      startRecordingClock();
    } catch (cause) {
      setIsRecording(false);
      recordingRef.current = false;
      setError(cause instanceof Error ? cause.message : "Unable to start voice recording.");
      await restorePlaybackAudioMode();
    }
  }, [recorder, restorePlaybackAudioMode, startRecordingClock]);

  const toggleRecordingPause = () => {
    if (!recordingRef.current) return;
    if (voiceRecordingPaused) {
      recorderRef.current.record();
      setVoiceRecordingPaused(false);
      startRecordingClock();
    } else {
      recorderRef.current.pause();
      setVoiceRecordingPaused(true);
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  };

  const cancelRecording = async () => {
    const uri = await stopRecording(false);
    if (uri) {
      try {
        new File(uri).delete();
      } catch (cause) {
        console.warn("Could not remove cancelled voice note.", cause);
      }
    }
    setPendingVoiceUri(null);
  };

  useEffect(() => () => {
    clearRecordingTimers();
    if (recordingRef.current) {
      recordingRef.current = false;
      void recorderRef.current.stop();
    }
  }, [clearRecordingTimers]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void fetchNativeVibesProStatus(userId)
      .then((status) => {
        if (active) setIsVibesPro(status);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Your chat appearance could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [userId]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId || !recipientId) {
      setLoading(false);
      setError("A valid signed-in account and conversation recipient are required.");
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setMessages([]);
    setConversationId(null);

    void Promise.all([
      fetchNativeChatRecipient(recipientId),
      resolveNativeConversation(recipientId),
    ]).then(async ([profile, conversation]) => {
      if (!active) return;
      if (conversation.user_1 !== userId && conversation.user_2 !== userId) {
        throw new Error("You are not a member of this conversation.");
      }
      setRecipient(profile as Recipient);
      setConversationId(conversation.id);
      const initialPage = await fetchNativeConversationMessages(conversation.id);
      if (!active) return;
      setMessages((current) => {
        const byId = new Map(current.map((message) => [message.id, message]));
        for (const message of initialPage.messages) byId.set(message.id, message);
        return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
      });
      setHasOlderMessages(initialPage.hasMore);
      await markNativeMessagesAsRead(conversation.id, userId);
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "This conversation could not be opened.");
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [authLoading, recipientId, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const messageChannel = subscribeToNativeMessages(conversationId, (message, event) => {
      if (event === "DELETE") {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        return;
      }
      setMessages((current) => {
        const existing = current.some((item) => item.id === message.id);
        return existing
          ? current.map((item) => item.id === message.id ? message : item)
          : [...current, message].sort((left, right) => left.created_at.localeCompare(right.created_at));
      });
      if (event === "INSERT" && message.sender_id !== userId) {
        void markNativeMessagesAsRead(conversationId, userId).catch((cause: unknown) => {
          console.warn("Could not mark incoming messages as read.", cause);
        });
      }
    });

    const typingChannel = nativeSupabase
      .channel(`native-typing:${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.sender_id === userId) return;
        setTyping(Boolean(payload?.typing));
      })
      .subscribe();
    typingChannelRef.current = typingChannel;

    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingChannelRef.current = null;
      void nativeSupabase.removeChannel(messageChannel);
      void nativeSupabase.removeChannel(typingChannel);
    };
  }, [conversationId, recipientId, userId]);

  const sendTyping = useCallback((value: string) => {
    if (!conversationId || !userId || !typingChannelRef.current) return;
    const isTyping = value.trim().length > 0;
    void typingChannelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { sender_id: userId, typing: isTyping },
    }).catch((cause: unknown) => console.warn("Could not update typing status.", cause));
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = setTimeout(() => {
        void typingChannelRef.current?.send({
          type: "broadcast",
          event: "typing",
          payload: { sender_id: userId, typing: false },
        });
      }, 1500);
    }
  }, [conversationId, userId]);

  const chooseMedia = async () => {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("Allow photo-library access to attach media.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsEditing: false,
        selectionLimit: 1,
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error("The selected media could not be read.");
      const kind = asset.type === "video" ? "video" : "image";
      const name = asset.fileName || `${Date.now()}.${kind === "video" ? "mp4" : "jpg"}`;
      const mimeType = asset.mimeType || (kind === "video" ? "video/mp4" : "image/jpeg");
      if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) {
        throw new Error("Attachments must be 25 MB or smaller.");
      }
      setPendingVoiceUri(null);
      setAttachment({
        uri: asset.uri,
        name,
        mimeType,
        size: asset.fileSize ?? null,
        kind,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to select media.");
    }
  };

  const chooseDocument = async () => {
    setError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset) throw new Error("The selected file could not be read.");
      if (asset.size && asset.size > 25 * 1024 * 1024) {
        throw new Error("Attachments must be 25 MB or smaller.");
      }
      setPendingVoiceUri(null);
      setAttachment({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType || "application/octet-stream",
        size: asset.size ?? null,
        kind: "file",
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to select a file.");
    }
  };

  const openAttachmentPicker = () => {
    setAttachmentPickerVisible(true);
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && !attachment && !pendingVoiceUri) || !conversationId || !userId || sending || editTarget || isRecording) return;
    setSending(true);
    setError(null);
    try {
      const upload = attachment
        ? await uploadNativeChatAttachment(attachment, conversationId)
        : pendingVoiceUri
          ? { audioUrl: await uploadNativeVoiceNote(pendingVoiceUri, conversationId) }
          : undefined;
      const messageType = attachment?.kind ?? (pendingVoiceUri ? "audio" : undefined);
      const message = await sendNativeMessage(conversationId, userId, {
        text,
        replyTo: replyTo ?? undefined,
        upload,
        messageType,
      });
      setMessages((current) => current.some((item) => item.id === message.id)
        ? current
        : [...current, message].sort((left, right) => left.created_at.localeCompare(right.created_at)));
      setInput("");
      setReplyTo(null);
      setAttachment(null);
      setPendingVoiceUri(null);
      setEmojiPickerVisible(false);
      sendTyping("");
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your message or attachment could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const loadOlderMessages = async () => {
    const oldestMessage = messages[0];
    if (!conversationId || !oldestMessage || !hasOlderMessages || loadingOlderMessages) return;
    setLoadingOlderMessages(true);
    setError(null);
    try {
      const page = await fetchNativeConversationMessages(
        conversationId,
        oldestMessage.created_at,
      );
      suppressAutoScrollRef.current = page.messages.length > 0;
      setMessages((current) => {
        const byId = new Map(page.messages.map((message) => [message.id, message]));
        for (const message of current) byId.set(message.id, message);
        return [...byId.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
      });
      setHasOlderMessages(page.hasMore);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Older messages could not be loaded.");
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const submitEdit = async () => {
    const text = input.trim();
    if (!editTarget || !userId || !text || sending) return;
    setSending(true);
    setError(null);
    try {
      const updated = await editNativeMessage(editTarget.id, userId, text);
      setMessages((current) => current.map((message) => message.id === updated.id ? updated : message));
      setEditTarget(null);
      setInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The message could not be edited.");
    } finally {
      setSending(false);
    }
  };

  const removeMessage = (message: Message) => {
    if (!userId) return;
    Alert.alert("Delete message?", "This removes the message from the conversation.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteNativeMessage(message.id, userId)
            .then(() => setMessages((current) => current.filter((item) => item.id !== message.id)))
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The message could not be deleted."));
        },
      },
    ]);
  };

  const closeMessageActions = () => {
    setSelectedMessageId(null);
    setForwardPickerVisible(false);
    setMessageActionError(null);
  };

  const startNativeCall = (callType: "audio" | "video") => {
    if (!conversationId || !recipientId || !recipient) return;
    if (Constants.appOwnership === "expo") {
      Alert.alert(
        "Development build required",
        "Audio and video calls need the MeToYou development build. Expo Go does not include the native WebRTC module.",
      );
      return;
    }
    void startCall({
      conversationId,
      recipientId,
      recipientName: recipient.username,
      callType,
    }).catch((cause: unknown) => {
      Alert.alert("Call could not start", cause instanceof Error ? cause.message : "Check your connection and try again.");
    });
  };

  const showForwardRecipients = async () => {
    if (!userId) return;
    setForwardPickerVisible(true);
    setLoadingForwardThreads(true);
    setMessageActionError(null);
    try {
      const threads = await fetchNativeMessageThreads(userId);
      setForwardThreads(threads.filter((thread) => thread.conversationId !== conversationId));
    } catch (cause) {
      setMessageActionError(cause instanceof Error ? cause.message : "Chats could not be loaded.");
    } finally {
      setLoadingForwardThreads(false);
    }
  };

  const forwardMessage = async (message: Message, thread: MessageThread) => {
    if (!userId || forwardingToId) return;
    setForwardingToId(thread.otherId);
    setMessageActionError(null);
    const attachmentKeys = ["attachment_url", "attachment_name", "attachment_mime_type", "attachment_size"];
    const attachmentMetadata = Object.fromEntries(
      attachmentKeys
        .filter((key) => message.metadata && key in message.metadata)
        .map((key) => [key, message.metadata?.[key]]),
    );
    const upload: NativeChatUpload = {
      imageUrl: message.image_url ?? undefined,
      videoUrl: message.video_url ?? undefined,
      audioUrl: message.audio_url ?? undefined,
      ...(Object.keys(attachmentMetadata).length ? { attachmentMetadata } : {}),
    };

    try {
      await sendNativeMessage(thread.conversationId, userId, {
        text: message.text ?? undefined,
        upload,
        messageType: message.message_type ?? undefined,
        forwarded: true,
      });
      closeMessageActions();
      Alert.alert("Message forwarded", `Sent to ${thread.otherUsername}.`);
    } catch (cause) {
      setMessageActionError(cause instanceof Error ? cause.message : "The message could not be forwarded.");
    } finally {
      setForwardingToId(null);
    }
  };

  const toggleReaction = async (message: Message, emoji: string) => {
    if (!userId) return;
    const existing = message.reactions?.[emoji] ?? [];
    const action = existing.includes(userId) ? "remove" : "add";
    try {
      const result = await reactToNativeMessage(message.id, emoji, action);
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, reactions: result.reactions }
        : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The reaction could not be saved.");
    }
    setSelectedMessageId(null);
  };

  const startEdit = (message: Message) => {
    setEditTarget(message);
    setReplyTo(null);
    setInput(message.text ?? "");
    setSelectedMessageId(null);
  };

  const colors = NATIVE_THEME_COLORS[theme].background;
  const primaryText = styles.premiumText;
  const mutedText = styles.premiumMuted;
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null;

  return (
    <LinearGradient colors={colors} end={{ x: 1, y: 1 }} start={{ x: 0, y: 0 }} style={styles.root}>
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboard}
        >
          <View style={[styles.header, isVibesPro && styles.premiumHeader, isBlueSky && styles.blueSkyHeader]}>
            <Pressable accessibilityLabel="Back to messages" accessibilityRole="button" onPress={() => router.replace("/(app)/messages")} style={styles.backButton}>
              <Text style={[styles.backText, primaryText]}>‹</Text>
            </Pressable>
            {recipient?.profile_pic ? (
              <Image source={{ uri: recipient.profile_pic }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, isVibesPro && styles.premiumAvatar]}>
                <Text style={styles.avatarInitial}>{recipient?.username?.slice(0, 1).toUpperCase() ?? "?"}</Text>
              </View>
            )}
            <View style={styles.headerCopy}>
              <Text numberOfLines={1} style={[styles.title, primaryText]}>{recipient?.username ?? "Conversation"}</Text>
              <Text style={[styles.subtitle, mutedText]}>
                {typing ? "Typing…" : getPresenceLabel({
                  isOnline: recipientPresence.isOnline,
                  lastActive: recipientPresence.lastActive,
                })}
              </Text>
            </View>
            <Pressable accessibilityLabel="Start audio call" accessibilityRole="button" disabled={loading || !conversationId} onPress={() => startNativeCall("audio")} style={[styles.headerAction, isVibesPro && styles.premiumAction, (loading || !conversationId) && styles.disabledButton]}>
              <Text style={styles.actionEmoji}>📞</Text>
            </Pressable>
            <Pressable accessibilityLabel="Start video call" accessibilityRole="button" disabled={loading || !conversationId} onPress={() => startNativeCall("video")} style={[styles.headerAction, isVibesPro && styles.premiumAction, (loading || !conversationId) && styles.disabledButton]}>
              <Text style={styles.actionEmoji}>🎥</Text>
            </Pressable>
          </View>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable accessibilityLabel="Dismiss error" onPress={() => setError(null)}>
                <Text style={styles.errorDismiss}>×</Text>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#ffffff" />
              <Text style={[styles.loadingText, mutedText]}>Opening conversation…</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              contentContainerStyle={styles.messageList}
              data={messages}
              keyExtractor={(message) => message.id}
              keyboardShouldPersistTaps="handled"
              maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
              onContentSizeChange={() => {
                if (suppressAutoScrollRef.current) {
                  suppressAutoScrollRef.current = false;
                  return;
                }
                listRef.current?.scrollToEnd({ animated: false });
              }}
              renderItem={({ item }) => {
                const mine = item.sender_id === userId;
                const replyText = getReplyText(item);
                const fileUrl = getMetadataText(item, "attachment_url");
                const fileName = getMetadataText(item, "attachment_name") || "Attached file";
                return (
                  <View style={[styles.messageRow, mine && styles.mineRow]}>
                    <Pressable
                      onLongPress={() => {
                        setMessageActionError(null);
                        setForwardPickerVisible(false);
                        setSelectedMessageId(item.id);
                      }}
                      style={[
                        styles.bubble,
                        mine ? styles.mineBubble : styles.theirBubble,
                        isBlueSky && (mine ? styles.blueSkyMineBubble : styles.blueSkyTheirBubble),
                        isVibesPro && (mine ? styles.premiumMineBubble : styles.premiumTheirBubble),
                      ]}
                    >
                      {item.metadata?.forwarded === true ? (
                        <Text style={[styles.forwardedLabel, mine && styles.mineForwardedLabel]}>↪ Forwarded</Text>
                      ) : null}
                      {replyText ? (
                        <View style={[styles.replyQuote, mine && styles.mineReplyQuote]}>
                          <Text numberOfLines={2} style={[styles.replyQuoteText, mine && styles.mineReplyQuoteText]}>{replyText}</Text>
                        </View>
                      ) : null}
                      {item.text ? (
                        <Text style={[styles.messageText, mine && styles.mineMessageText, isVibesPro && !mine && styles.premiumText]}>
                          {item.text}
                        </Text>
                      ) : null}
                      {item.image_url ? (
                        <Pressable
                          accessibilityLabel="Open image attachment"
                          onPress={() => void Linking.openURL(item.image_url!).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The image could not be opened."))}
                        >
                          <Image source={{ uri: item.image_url }} resizeMode="cover" style={styles.imageAttachment} />
                        </Pressable>
                      ) : null}
                      {item.video_url ? (
                        <Pressable
                          accessibilityLabel="Open video attachment"
                          onPress={() => void Linking.openURL(item.video_url!).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The video could not be opened."))}
                          style={[styles.fileAttachment, mine && styles.mineFileAttachment]}
                        >
                          <Text style={styles.fileAttachmentIcon}>▶</Text>
                          <Text style={[styles.fileAttachmentName, mine && styles.mineMessageText]}>Open video</Text>
                        </Pressable>
                      ) : null}
                      {item.audio_url ? <NativeVoiceMessage isVibesPro={isVibesPro} mine={mine} uri={item.audio_url} /> : null}
                      {fileUrl ? (
                        <Pressable
                          accessibilityLabel={`Open attachment ${fileName}`}
                          onPress={() => void Linking.openURL(fileUrl).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "The file could not be opened."))}
                          style={[styles.fileAttachment, mine && styles.mineFileAttachment]}
                        >
                          <Text style={styles.fileAttachmentIcon}>↗</Text>
                          <Text numberOfLines={2} style={[styles.fileAttachmentName, mine && styles.mineMessageText]}>{fileName}</Text>
                        </Pressable>
                      ) : null}
                      <View style={styles.messageMeta}>
                        {item.edited_at ? <Text style={[styles.messageTime, mine && styles.mineTime]}>Edited · </Text> : null}
                        <Text style={[styles.messageTime, mine && styles.mineTime]}>{formatDisplayTime(item.created_at)}</Text>
                        {mine ? <Text style={styles.receipt}>{item.read_at || item.status === "read" ? "  👀" : "  📨"}</Text> : null}
                      </View>
                      {Object.entries(item.reactions ?? {}).map(([emoji, users]) => (
                        <Pressable key={emoji} onPress={() => void toggleReaction(item, emoji)} style={styles.reactionChip}>
                          <Text style={styles.reactionText}>{emoji} {users.length}</Text>
                        </Pressable>
                      ))}
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={[styles.emptyEmoji]}>💬</Text>
                  <Text style={[styles.emptyTitle, primaryText]}>Start the conversation</Text>
                  <Text style={[styles.emptyCopy, mutedText]}>Send a message to {recipient?.username ?? "your friend"}.</Text>
                </View>
              }
              ListHeaderComponent={hasOlderMessages ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loadingOlderMessages}
                  onPress={() => void loadOlderMessages()}
                  style={styles.loadOlderButton}
                >
                  {loadingOlderMessages
                    ? <ActivityIndicator color="#ffffff" size="small" />
                    : <Text style={[styles.loadOlderText, mutedText]}>Load earlier messages</Text>}
                </Pressable>
              ) : null}
            />
          )}

          <View style={[styles.composer, isVibesPro && styles.premiumComposer, isBlueSky && styles.blueSkyComposer]}>
            {(replyTo || editTarget) && !isRecording ? (
              <View style={[styles.replyBar, isVibesPro && styles.premiumReplyBar]}>
                <View style={styles.replyBarCopy}>
                  <Text style={[styles.replyBarTitle, isVibesPro && styles.premiumText]}>{editTarget ? "Editing message" : "Replying"}</Text>
                  <Text numberOfLines={1} style={[styles.replyBarMessage, mutedText]}>{(editTarget ?? replyTo)?.text || "Message"}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Cancel reply or edit"
                  onPress={() => { setReplyTo(null); setEditTarget(null); setInput(""); }}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            {isRecording ? (
              <View style={[styles.recordingControls, isVibesPro && styles.premiumRecordingControls]}>
                <Pressable
                  accessibilityLabel="Cancel voice note"
                  accessibilityRole="button"
                  onPress={() => void cancelRecording()}
                  style={styles.stopRecordingButton}
                >
                  <Text style={styles.stopRecordingGlyph}>×</Text>
                </Pressable>
                <View style={styles.recordingWaveformPanel}>
                  <View style={styles.recordingTimeRow}>
                    <View style={styles.recordingDot} />
                    <Text style={[styles.recordingLabel, isVibesPro && styles.premiumText]}>
                      {voiceRecordingPaused ? "Paused" : "Recording"} · {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                    </Text>
                  </View>
                  <RecordingWaveform isVibesPro={isVibesPro} samples={waveformSamples} />
                </View>
                <Pressable
                  accessibilityLabel={voiceRecordingPaused ? "Resume recording" : "Pause recording"}
                  accessibilityRole="button"
                  onPress={toggleRecordingPause}
                  style={[styles.pauseRecordingButton, isVibesPro && styles.premiumPauseRecordingButton]}
                >
                  <Text style={[styles.pauseRecordingGlyph, isVibesPro && styles.premiumText]}>
                    {voiceRecordingPaused ? "▶" : "Ⅱ"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Send voice note"
                  accessibilityRole="button"
                  onPress={() => void stopRecording(true)}
                  style={[styles.lockedSendButton, isVibesPro && styles.premiumLockedSendButton]}
                >
                  <Text style={styles.lockedSendGlyph}>➤</Text>
                </Pressable>
              </View>
            ) : null}
            {pendingVoiceUri ? (
              <NativeVoicePreview
                isVibesPro={isVibesPro}
                onRemove={() => setPendingVoiceUri(null)}
                uri={pendingVoiceUri}
              />
            ) : null}
            {attachment ? (
              <View style={[styles.pendingMedia, isVibesPro && styles.premiumPendingMedia]}>
                {attachment.kind === "image" ? (
                  <Image source={{ uri: attachment.uri }} resizeMode="cover" style={styles.pendingImage} />
                ) : null}
                <View style={styles.pendingMediaCopy}>
                  <Text numberOfLines={1} style={[styles.pendingMediaName, isVibesPro && styles.premiumText]}>{attachment.name}</Text>
                  <Text style={[styles.pendingMediaType, isVibesPro && styles.premiumMuted]}>
                    {attachment.size === null ? attachment.kind : `${attachment.kind} · ${(attachment.size / (1024 * 1024)).toFixed(1)} MB`}
                  </Text>
                </View>
                <Pressable accessibilityLabel="Remove attachment" onPress={() => setAttachment(null)} style={styles.cancelButton}>
                  <Text style={styles.cancelText}>×</Text>
                </Pressable>
              </View>
            ) : null}
            {emojiPickerVisible && !isRecording ? (
              <View style={[styles.emojiPanel, isVibesPro && styles.premiumEmojiPanel]}>
                {EMOJIS.map((emoji) => (
                  <Pressable key={emoji} onPress={() => setInput((value) => `${value}${emoji}`)} style={styles.emojiButton}>
                    <Text style={styles.emoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {!isRecording ? (
              <View style={styles.composerRow}>
                  <Pressable accessibilityLabel="Attach photo, video, or file" disabled={sending} onPress={openAttachmentPicker} style={[styles.utilityButton, isVibesPro && styles.premiumAction, sending && styles.disabledButton]}>
                    <Text style={[styles.utilityGlyph, primaryText]}>＋</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Record voice note"
                    accessibilityRole="button"
                    disabled={sending || Boolean(attachment) || Boolean(pendingVoiceUri) || loading}
                    onPress={() => void startRecording()}
                    style={[styles.utilityButton, styles.voiceRecordButton, isVibesPro && styles.premiumAction, (sending || attachment || pendingVoiceUri || loading) && styles.disabledButton]}
                  >
                    <Mic color="#ffffff" size={20} strokeWidth={2.4} />
                  </Pressable>
                  <TextInput
                    accessibilityLabel="Message"
                    editable={!loading && !sending}
                    multiline
                    onChangeText={(value) => { setInput(value); sendTyping(value); }}
                    onBlur={() => setInputFocused(false)}
                    onFocus={() => setInputFocused(true)}
                    onSubmitEditing={() => void (editTarget ? submitEdit() : send())}
                    placeholder="Type a message…"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    returnKeyType="send"
                    style={[styles.input, isVibesPro && styles.premiumInput]}
                    value={input}
                  />
                  {!inputFocused ? (
                    <Pressable accessibilityLabel="Choose emoji" onPress={() => setEmojiPickerVisible((visible) => !visible)} style={[styles.utilityButton, isVibesPro && styles.premiumAction]}>
                      <Text style={styles.actionEmoji}>😊</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityLabel={editTarget ? "Save edited message" : "Send message"}
                    accessibilityRole="button"
                    disabled={(!input.trim() && !attachment && !pendingVoiceUri) || sending || loading}
                    onPress={() => void (editTarget ? submitEdit() : send())}
                    style={[styles.sendButton, isVibesPro && styles.premiumSendButton, ((!input.trim() && !attachment && !pendingVoiceUri) || sending || loading) && styles.disabledButton]}
                  >
                    {sending ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={[styles.sendGlyph, isVibesPro && styles.premiumSendGlyph]}>{editTarget ? "✓" : "➤"}</Text>}
                  </Pressable>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      <Modal
        animationType="fade"
        onRequestClose={closeMessageActions}
        statusBarTranslucent
        transparent
        visible={Boolean(selectedMessage)}
      >
        <View style={styles.pickerOverlay}>
          <Pressable
            accessibilityLabel="Close message options"
            onPress={closeMessageActions}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.messageActionSheet, isVibesPro && styles.premiumPickerSheet]}>
            <View style={[styles.pickerHandle, isVibesPro && styles.premiumPickerHandle]} />
            {forwardPickerVisible ? (
              <>
                <View style={styles.messageActionHeading}>
                  <Pressable
                    accessibilityLabel="Back to message options"
                    onPress={() => {
                      setForwardPickerVisible(false);
                      setMessageActionError(null);
                    }}
                    style={[styles.pickerClose, isVibesPro && styles.premiumAction]}
                  >
                    <Text style={[styles.pickerCloseText, isVibesPro && styles.premiumText]}>‹</Text>
                  </Pressable>
                  <View style={styles.pickerHeadingCopy}>
                    <Text style={[styles.pickerTitle, isVibesPro && styles.premiumText]}>Forward to</Text>
                    <Text style={[styles.pickerSubtitle, isVibesPro && styles.premiumMuted]}>Choose a MeToYou chat</Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close message options"
                    onPress={closeMessageActions}
                    style={[styles.pickerClose, isVibesPro && styles.premiumAction]}
                  >
                    <Text style={[styles.pickerCloseText, isVibesPro && styles.premiumText]}>×</Text>
                  </Pressable>
                </View>
                {loadingForwardThreads ? (
                <ActivityIndicator color="#ffffff" style={styles.forwardLoading} />
                ) : forwardThreads.length ? (
                  <ScrollView style={styles.forwardThreadList}>
                    {forwardThreads.map((thread) => (
                      <Pressable
                        accessibilityRole="button"
                        disabled={Boolean(forwardingToId)}
                        key={thread.conversationId}
                        onPress={() => selectedMessage && void forwardMessage(selectedMessage, thread)}
                        style={({ pressed }) => [
                          styles.forwardThread,
                          isVibesPro && styles.premiumPickerOption,
                          pressed && styles.pickerOptionPressed,
                        ]}
                      >
                        <View style={[styles.forwardAvatar, isVibesPro && styles.premiumPickerHeadingIcon]}>
                          <Text style={[styles.forwardAvatarText, isVibesPro && styles.premiumText]}>
                            {thread.otherUsername.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.forwardThreadName, isVibesPro && styles.premiumText]}>{thread.otherUsername}</Text>
                        {forwardingToId === thread.otherId
                          ? <ActivityIndicator color="#ffffff" size="small" />
                          : <Text style={[styles.pickerChevron, isVibesPro && styles.premiumMuted]}>›</Text>}
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={[styles.forwardEmpty, isVibesPro && styles.premiumMuted]}>
                    No other chats are available to forward to yet.
                  </Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.messageActionHeading}>
                  <View style={styles.pickerHeadingIcon}>
                    <Text style={styles.pickerHeadingEmoji}>✨</Text>
                  </View>
                  <View style={styles.pickerHeadingCopy}>
                    <Text style={[styles.pickerTitle, isVibesPro && styles.premiumText]}>Message options</Text>
                    <Text numberOfLines={2} style={[styles.pickerSubtitle, isVibesPro && styles.premiumMuted]}>
                      {selectedMessage?.text || (selectedMessage?.image_url ? "Photo" : selectedMessage?.video_url ? "Video" : selectedMessage?.audio_url ? "Voice note" : "Attachment")}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel="Close message options"
                    onPress={closeMessageActions}
                    style={[styles.pickerClose, isVibesPro && styles.premiumAction]}
                  >
                    <Text style={[styles.pickerCloseText, isVibesPro && styles.premiumText]}>×</Text>
                  </Pressable>
                </View>
                <View style={[styles.messageReactionRow, isVibesPro && styles.premiumMessageReactionRow]}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <Pressable
                      accessibilityLabel={`React with ${emoji}`}
                      accessibilityRole="button"
                      key={emoji}
                      onPress={() => selectedMessage && void toggleReaction(selectedMessage, emoji)}
                      style={styles.messageReactionButton}
                    >
                      <Text style={styles.messageReactionEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={() => {
                    if (!selectedMessage) return;
                    setReplyTo(selectedMessage);
                    setEditTarget(null);
                    closeMessageActions();
                  }}
                  style={[styles.messageActionRow, isVibesPro && styles.premiumPickerOption]}
                >
                  <Text style={styles.messageActionEmoji}>↩️</Text>
                  <Text style={[styles.messageActionLabel, isVibesPro && styles.premiumText]}>Reply</Text>
                </Pressable>
                <Pressable
                  onPress={() => void showForwardRecipients()}
                  style={[styles.messageActionRow, isVibesPro && styles.premiumPickerOption]}
                >
                  <Text style={styles.messageActionEmoji}>↗️</Text>
                  <Text style={[styles.messageActionLabel, isVibesPro && styles.premiumText]}>Forward</Text>
                </Pressable>
                {selectedMessage && selectedMessage.sender_id === userId && selectedMessage.text ? (
                  <Pressable
                    onPress={() => {
                      startEdit(selectedMessage);
                      closeMessageActions();
                    }}
                    style={[styles.messageActionRow, isVibesPro && styles.premiumPickerOption]}
                  >
                    <Text style={styles.messageActionEmoji}>✏️</Text>
                    <Text style={[styles.messageActionLabel, isVibesPro && styles.premiumText]}>Edit</Text>
                  </Pressable>
                ) : null}
                {selectedMessage && selectedMessage.sender_id === userId ? (
                  <Pressable
                    onPress={() => {
                      const messageToDelete = selectedMessage;
                      closeMessageActions();
                      removeMessage(messageToDelete);
                    }}
                    style={[styles.messageActionRow, styles.deleteActionRow]}
                  >
                    <Text style={styles.messageActionEmoji}>🗑️</Text>
                    <Text style={[styles.messageActionLabel, styles.deleteLabel]}>Delete</Text>
                  </Pressable>
                ) : null}
              </>
            )}
            {messageActionError ? (
              <Text accessibilityRole="alert" style={styles.messageActionError}>{messageActionError}</Text>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setAttachmentPickerVisible(false)}
        statusBarTranslucent
        transparent
        visible={attachmentPickerVisible}
      >
        <View style={styles.pickerOverlay}>
          <Pressable
            accessibilityLabel="Close attachment options"
            onPress={() => setAttachmentPickerVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.pickerSheet, isVibesPro && styles.premiumPickerSheet]}>
            <View style={[styles.pickerHandle, isVibesPro && styles.premiumPickerHandle]} />
            <View style={styles.pickerHeadingRow}>
              <View style={[styles.pickerHeadingIcon, isVibesPro && styles.premiumPickerHeadingIcon]}>
                <Text style={styles.pickerHeadingEmoji}>✨</Text>
              </View>
              <View style={styles.pickerHeadingCopy}>
                <Text style={[styles.pickerTitle, isVibesPro && styles.premiumText]}>Add a little something</Text>
                <Text style={[styles.pickerSubtitle, isVibesPro && styles.premiumMuted]}>Choose what you want to share</Text>
              </View>
              <Pressable
                accessibilityLabel="Close attachment options"
                onPress={() => setAttachmentPickerVisible(false)}
                style={[styles.pickerClose, isVibesPro && styles.premiumAction]}
              >
                <Text style={[styles.pickerCloseText, isVibesPro && styles.premiumText]}>×</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAttachmentPickerVisible(false);
                setTimeout(() => void chooseMedia(), 180);
              }}
              style={({ pressed }) => [
                styles.pickerOption,
                isVibesPro && styles.premiumPickerOption,
                pressed && styles.pickerOptionPressed,
              ]}
            >
              <View style={[styles.pickerOptionIcon, styles.photoOptionIcon]}>
                <Text style={styles.pickerOptionEmoji}>🖼️</Text>
              </View>
              <View style={styles.pickerOptionCopy}>
                <Text style={[styles.pickerOptionTitle, isVibesPro && styles.premiumText]}>Photos & videos</Text>
                <Text style={[styles.pickerOptionDescription, isVibesPro && styles.premiumMuted]}>Pick a moment from your library</Text>
              </View>
              <Text style={[styles.pickerChevron, isVibesPro && styles.premiumMuted]}>›</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAttachmentPickerVisible(false);
                setTimeout(() => void chooseDocument(), 180);
              }}
              style={({ pressed }) => [
                styles.pickerOption,
                isVibesPro && styles.premiumPickerOption,
                pressed && styles.pickerOptionPressed,
              ]}
            >
              <View style={[styles.pickerOptionIcon, styles.fileOptionIcon]}>
                <Text style={styles.pickerOptionEmoji}>📎</Text>
              </View>
              <View style={styles.pickerOptionCopy}>
                <Text style={[styles.pickerOptionTitle, isVibesPro && styles.premiumText]}>Browse files</Text>
                <Text style={[styles.pickerOptionDescription, isVibesPro && styles.premiumMuted]}>Share a document or other file</Text>
              </View>
              <Text style={[styles.pickerChevron, isVibesPro && styles.premiumMuted]}>›</Text>
            </Pressable>

            <Text style={[styles.pickerFootnote, isVibesPro && styles.premiumMuted]}>Files up to 25 MB</Text>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  keyboard: { flex: 1 },
  header: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#252a33", backgroundColor: "rgba(5,7,11,0.92)" },
  blueSkyHeader: { borderBottomColor: "#3478bd", backgroundColor: "rgba(6,26,58,0.94)" },
  premiumHeader: { borderBottomColor: "#252a33", backgroundColor: "rgba(5,7,11,0.92)" },
  backButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  backText: { fontSize: 36, lineHeight: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#252b35" },
  premiumAvatar: { backgroundColor: "#252b35" },
  avatarInitial: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: "900" },
  subtitle: { marginTop: 3, fontSize: 11 },
  text: { color: "#ffffff" },
  premiumText: { color: "#ffffff" },
  muted: { color: "rgba(255,255,255,0.62)" },
  premiumMuted: { color: "rgba(255,255,255,0.62)" },
  headerAction: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 14, backgroundColor: "#151a22" },
  premiumAction: { borderColor: "#353b46", backgroundColor: "#151a22" },
  actionEmoji: { fontSize: 17 },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginTop: 10, padding: 10, borderWidth: 1, borderColor: "#454b55", borderRadius: 15, backgroundColor: "#151a22" },
  errorText: { flex: 1, color: "#fda4af", fontSize: 12 },
  errorDismiss: { color: "#fda4af", fontSize: 22, paddingHorizontal: 4 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { fontSize: 13 },
  messageList: { flexGrow: 1, justifyContent: "flex-end", paddingHorizontal: 14, paddingVertical: 18, gap: 12 },
  loadOlderButton: { alignSelf: "center", minHeight: 36, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 6 },
  loadOlderText: { fontSize: 12, fontWeight: "700" },
  messageRow: { maxWidth: "88%", alignSelf: "flex-start" },
  mineRow: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { maxWidth: "100%", paddingHorizontal: 14, paddingTop: 10, paddingBottom: 7, borderRadius: 22 },
  mineBubble: { borderBottomRightRadius: 7, borderWidth: 1, borderColor: "#454b55", backgroundColor: "#303743" },
  theirBubble: { borderBottomLeftRadius: 7, borderWidth: 1, borderColor: "#2e3540", backgroundColor: "#171c25" },
  blueSkyMineBubble: { borderColor: "#54b8ff", backgroundColor: "#155192" },
  blueSkyTheirBubble: { borderColor: "#3478bd", backgroundColor: "#0b2d5b" },
  premiumMineBubble: { borderColor: "#454b55", backgroundColor: "#303743" },
  premiumTheirBubble: { borderColor: "#2e3540", backgroundColor: "#171c25" },
  messageText: { color: "#ffffff", fontSize: 15, lineHeight: 21 },
  mineMessageText: { color: "#ffffff" },
  imageAttachment: { width: 220, height: 220, marginTop: 8, borderRadius: 14, backgroundColor: "#252b35" },
  fileAttachment: { minWidth: 150, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, backgroundColor: "#252b35" },
  mineFileAttachment: { backgroundColor: "#454b55" },
  fileAttachmentIcon: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  fileAttachmentName: { flexShrink: 1, color: "#ffffff", fontSize: 13, fontWeight: "700" },
  voicePlayer: { width: 240, maxWidth: "100%", minHeight: 48, flexDirection: "row", alignItems: "center", gap: 9, marginTop: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: "#252b35" },
  mineVoicePlayer: { backgroundColor: "#454b55" },
  premiumVoicePlayer: { backgroundColor: "#252b35" },
  voicePlayerButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#303743" },
  mineVoicePlayerButton: { backgroundColor: "rgba(255,255,255,0.18)" },
  voicePlayerGlyph: { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  mineVoicePlayerGlyph: { color: "#ffffff" },
  playbackWaveform: { height: 28, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  playbackWaveformBar: { width: 3, minHeight: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)" },
  playedWaveformBar: { backgroundColor: "#ffffff" },
  playedWaveformBarMine: { backgroundColor: "#ffffff" },
  premiumPlaybackWaveformBar: { backgroundColor: "rgba(255,255,255,0.25)" },
  premiumPlayedWaveformBar: { backgroundColor: "#ffffff" },
  voicePlayerTime: { minWidth: 28, color: "rgba(255,255,255,0.62)", fontSize: 10, fontVariant: ["tabular-nums"], textAlign: "right" },
  messageMeta: { flexDirection: "row", justifyContent: "flex-end", marginTop: 5 },
  messageTime: { color: "rgba(255,255,255,0.62)", fontSize: 10 },
  mineTime: { color: "rgba(255,255,255,0.72)" },
  receipt: { color: "#dff7ff", fontSize: 10, fontWeight: "800" },
  replyQuote: { marginBottom: 7, paddingVertical: 4, paddingHorizontal: 8, borderLeftWidth: 3, borderLeftColor: "#ffffff", backgroundColor: "#252b35", borderRadius: 5 },
  mineReplyQuote: { borderLeftColor: "#ffffff", backgroundColor: "rgba(255,255,255,0.15)" },
  replyQuoteText: { color: "#ffffff", fontSize: 12 },
  mineReplyQuoteText: { color: "#ffffff" },
  reactionChip: { alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: "#454b55" },
  reactionText: { color: "#ffffff", fontSize: 12 },
  forwardedLabel: { marginBottom: 4, color: "#ffffff", fontSize: 10, fontWeight: "800" },
  mineForwardedLabel: { color: "rgba(255,255,255,0.82)" },
  deleteLabel: { color: "#be123c", fontSize: 11, fontWeight: "700" },
  messageActionSheet: { maxHeight: "78%", paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 34 : 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#10141b", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 },
  messageActionHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  messageReactionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12, padding: 7, borderRadius: 24, backgroundColor: "#171c25" },
  premiumMessageReactionRow: { backgroundColor: "#171c25" },
  messageReactionButton: { width: 48, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 },
  messageReactionEmoji: { fontSize: 25 },
  messageActionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#2e3540", borderRadius: 17, backgroundColor: "#171c25" },
  deleteActionRow: { borderColor: "#454b55", backgroundColor: "#252b35" },
  messageActionEmoji: { width: 26, fontSize: 19, textAlign: "center" },
  messageActionLabel: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  messageActionError: { marginTop: 4, color: "#fda4af", fontSize: 12 },
  forwardLoading: { paddingVertical: 28 },
  forwardThreadList: { maxHeight: 360 },
  forwardThread: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#2e3540", borderRadius: 18, backgroundColor: "#171c25" },
  forwardAvatar: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#252b35" },
  forwardAvatarText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  forwardThreadName: { flex: 1, color: "#ffffff", fontSize: 14, fontWeight: "700" },
  forwardEmpty: { paddingVertical: 22, color: "rgba(255,255,255,0.62)", fontSize: 12, textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyEmoji: { fontSize: 34 },
  emptyTitle: { marginTop: 10, color: "#ffffff", fontSize: 18, fontWeight: "900" },
  emptyCopy: { marginTop: 6, color: "rgba(255,255,255,0.62)", fontSize: 13, textAlign: "center" },
  composer: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: "#252a33", backgroundColor: "rgba(5,7,11,0.96)" },
  blueSkyComposer: { borderTopColor: "#3478bd", backgroundColor: "#0b2d5b" },
  premiumComposer: { borderTopColor: "#252a33", backgroundColor: "rgba(5,7,11,0.96)" },
  pickerOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.78)" },
  pickerSheet: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: Platform.OS === "ios" ? 34 : 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: "#10141b", shadowColor: "#000000", shadowOpacity: 0.28, shadowRadius: 24, shadowOffset: { width: 0, height: -8 }, elevation: 18 },
  premiumPickerSheet: { backgroundColor: "#10141b", borderTopWidth: 1, borderColor: "#292f39" },
  pickerHandle: { width: 40, height: 4, alignSelf: "center", marginBottom: 20, borderRadius: 2, backgroundColor: "#454b55" },
  premiumPickerHandle: { backgroundColor: "rgba(255,255,255,0.22)" },
  pickerHeadingRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  pickerHeadingIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#252b35" },
  premiumPickerHeadingIcon: { backgroundColor: "#252b35" },
  pickerHeadingEmoji: { fontSize: 23 },
  pickerHeadingCopy: { flex: 1 },
  pickerTitle: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  pickerSubtitle: { marginTop: 4, color: "rgba(255,255,255,0.62)", fontSize: 12 },
  pickerClose: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  pickerCloseText: { color: "#ffffff", fontSize: 24, lineHeight: 27 },
  pickerOption: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#2e3540", borderRadius: 20, backgroundColor: "#171c25" },
  premiumPickerOption: { borderColor: "#2e3540", backgroundColor: "#171c25" },
  pickerOptionPressed: { opacity: 0.72, transform: [{ scale: 0.985 }] },
  pickerOptionIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 16 },
  photoOptionIcon: { backgroundColor: "#252b35" },
  fileOptionIcon: { backgroundColor: "#252b35" },
  pickerOptionEmoji: { fontSize: 23 },
  pickerOptionCopy: { flex: 1 },
  pickerOptionTitle: { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  pickerOptionDescription: { marginTop: 4, color: "rgba(255,255,255,0.62)", fontSize: 11 },
  pickerChevron: { paddingHorizontal: 4, color: "#ffffff", fontSize: 26 },
  pickerFootnote: { marginTop: 2, color: "rgba(255,255,255,0.62)", fontSize: 10, textAlign: "center" },
  replyBar: { flexDirection: "row", alignItems: "center", marginBottom: 9, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: "#171c25" },
  premiumReplyBar: { backgroundColor: "#171c25" },
  replyBarCopy: { flex: 1 },
  replyBarTitle: { color: "#ffffff", fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  replyBarMessage: { marginTop: 2, fontSize: 12 },
  cancelButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#ffffff", fontSize: 24 },
  pendingMedia: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: "#171c25" },
  premiumPendingMedia: { backgroundColor: "#171c25" },
  pendingMediaCopy: { flex: 1, minWidth: 0 },
  pendingMediaName: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
  pendingMediaType: { marginTop: 3, color: "rgba(255,255,255,0.62)", fontSize: 10 },
  pendingImage: { width: 42, height: 42, borderRadius: 9 },
  previewPlay: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#303743" },
  previewPlayGlyph: { color: "#ffffff", fontSize: 14, fontWeight: "900" },
  recordingControls: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 6, paddingVertical: 8, borderRadius: 18, backgroundColor: "#171c25" },
  premiumRecordingControls: { backgroundColor: "#171c25" },
  recordingWaveformPanel: { flex: 1, minWidth: 0 },
  recordingTimeRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 3 },
  recordingStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#ef4444" },
  recordingLabel: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  waveform: { height: 34, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 2 },
  waveformBar: { width: 3, minHeight: 4, borderRadius: 3, backgroundColor: "#ffffff" },
  premiumWaveformBar: { backgroundColor: "#ffffff" },
  stopRecordingButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: "rgba(239,68,68,0.12)" },
  stopRecordingGlyph: { color: "#dc2626", fontSize: 24, lineHeight: 28 },
  pauseRecordingButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#303743" },
  premiumPauseRecordingButton: { backgroundColor: "#303743" },
  pauseRecordingGlyph: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  lockedSendButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#303743" },
  premiumLockedSendButton: { backgroundColor: "#303743" },
  lockedSendGlyph: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  voiceRecordButton: { overflow: "hidden" },
  emojiPanel: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8, padding: 6, borderRadius: 14, backgroundColor: "#171c25" },
  premiumEmojiPanel: { backgroundColor: "#171c25" },
  emojiButton: { width: "16.66%", alignItems: "center", paddingVertical: 7 },
  emoji: { fontSize: 23 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  utilityButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#353b46", borderRadius: 15, backgroundColor: "#151a22" },
  utilityGlyph: { fontSize: 25, lineHeight: 29 },
  input: { flex: 1, maxHeight: 110, minHeight: 40, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 8, borderWidth: 1, borderColor: "#454b55", borderRadius: 15, color: "#ffffff", backgroundColor: "#171c25", fontSize: 14 },
  premiumInput: { color: "#ffffff", backgroundColor: "#171c25" },
  sendButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#303743" },
  premiumSendButton: { backgroundColor: "#303743" },
  disabledButton: { opacity: 0.45 },
  sendGlyph: { color: "#ffffff", fontSize: 18, fontWeight: "900" },
  premiumSendGlyph: { color: "#ffffff" },
});
