import { useState, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Mic, Paperclip, Send, Smile, Square, X, Pause, Play } from "lucide-react";
import ChatBubble from "../components/ChatBubble";
import { useAuth } from "../hooks/useAuth";
import { useChat } from "../contexts/ChatContext";
import { useSession } from "../contexts/SessionContext";
import { supabase } from "../lib/supabase";
import { isVibesProEnabled } from "../lib/vibesPro";
import {
  sendMessage,
  fetchMessagesPage,
  findOrCreateConversation,
  subscribeToMessages,
  markMessagesAsRead,
  updateConversationLastMessageTime,
  sendTypingIndicator,
  subscribeToTyping,
  joinPresence,
  leavePresence,
  mergeMessages,
  editMessage,
  deleteMessage,
  type Message,
} from "../lib/messageApi";

export default function Chat() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getCachedMessages, setCachedMessages, addMessageToCache } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserAtBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const messagesLoadVersionRef = useRef(0);
  const scrollIdleTimeoutRef = useRef<number | null>(null);
  const searchBarVisibleRef = useRef(false);
  const hasMoreMessagesRef = useRef(hasMoreMessages);
  const isLoadingOlderMessagesRef = useRef(isLoadingOlderMessages);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const typingStateRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<number | null>(null);

  // Handle text input with smart typing indicators
  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setInputText(val);

    if (!conversationId || !userId) return;

    const isTyping = val.trim().length > 0;

    // State changed from not-typing to typing
    if (isTyping && !typingStateRef.current) {
      typingStateRef.current = true;
      void sendTypingIndicator(conversationId, userId, true);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to send stop-typing after 1.5 seconds of inactivity
    if (isTyping) {
      typingTimeoutRef.current = window.setTimeout(() => {
        typingStateRef.current = false;
        void sendTypingIndicator(conversationId, userId, false);
        typingTimeoutRef.current = null;
      }, 1500) as unknown as number;
    } else {
      // User cleared input, stop typing immediately
      if (typingStateRef.current) {
        typingStateRef.current = false;
        void sendTypingIndicator(conversationId, userId, false);
      }
    }
  }
  const recordingTimerRef = useRef<number | null>(null);
  const [presenceState, setPresenceState] = useState<Record<string, { last_active?: number; username?: string }>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const recipientId = searchParams.get("recipient") ?? "";
  const recipientName = searchParams.get("username") ?? "Friend";
  const userId = user?.id;
  const { profile: profileFromContext } = useSession();
  const profile = profileFromContext;
  const isVibesPro = isVibesProEnabled(profile);

  function createMessageId(prefix = "msg") {
    const randomPart =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${prefix}-${randomPart}`;
  }

  useEffect(() => {
    if (!userId || !recipientId) {
      if (conversationId !== null) {
        setConversationId(null);
      }
      return;
    }

    let mounted = true;
    (async () => {
      const conversation = await findOrCreateConversation(userId, recipientId);
      if (!mounted) return;

      if (!conversation) {
        setConversationId(null);
        setSendError("We couldn’t open this chat right now. Please try again.");
        return;
      }

      setConversationId(conversation.id);
      setSendError(null);
    })();

    return () => {
      mounted = false;
    };
  }, [userId, recipientId]);

  useEffect(() => {
    if (!conversationId) return;

    let mounted = true;
    const loadVersion = ++messagesLoadVersionRef.current;
    const pageSize = 30;

    const cachedMessages = getCachedMessages(conversationId);
    if (cachedMessages && cachedMessages.length > 0) {
      setMessages(mergeMessages(cachedMessages));
      setMessagesLoading(false);
    } else {
      setMessages([]);
      setMessagesLoading(true);
    }

    setHasMoreMessages(false);
    setIsLoadingOlderMessages(false);

    const load = async () => {
      try {
        const initialPage = await fetchMessagesPage(conversationId, undefined, pageSize + 1);
        if (!mounted || loadVersion !== messagesLoadVersionRef.current) return;

        const visibleMessages = initialPage.slice(0, pageSize);
        const nextMessages = mergeMessages([...(cachedMessages ?? []), ...visibleMessages]);

        setMessages(nextMessages);
        setCachedMessages(conversationId, nextMessages);
        setHasMoreMessages(initialPage.length > pageSize);

        if (userId) {
          void markMessagesAsRead(conversationId, userId);
        }
      } finally {
        if (mounted) setMessagesLoading(false);
      }
    };

    void load();

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    subscriptionRef.current = subscribeToMessages(conversationId, (newMessage) => {
      // Handle delete markers
      if ((newMessage.metadata as any)?.deleted) {
        setMessages((current) => current.filter((msg) => msg.id !== newMessage.id));
        if (conversationId) {
          Promise.resolve().then(() => {
            const cache = getCachedMessages(conversationId);
            if (cache) {
              const updated = cache.filter((msg) => msg.id !== newMessage.id);
              setCachedMessages(conversationId, updated);
            }
          });
        }
        return;
      }

      // Ignore duplicate incoming messages by id. If message exists, replace it (update), otherwise insert.
      setMessages((current) => {
        const exists = current.some((m) => m.id === newMessage.id);
        if (exists) {
          return mergeMessages(current.map((m) => (m.id === newMessage.id ? newMessage : m)));
        }
        return mergeMessages([...current, newMessage]);
      });

      Promise.resolve().then(() => addMessageToCache(conversationId, newMessage));
    });

    // typing subscription
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

    // presence subscription
    if (presenceChannelRef.current) {
      try {
        presenceChannelRef.current.unsubscribe();
      } catch (err) {
        console.warn(err);
      }
      presenceChannelRef.current = null;
    }

    if (userId) {
      const presenceChannel = joinPresence(conversationId, userId, (state) => {
        setPresenceState(state);
      }, { username: recipientName });
      presenceChannelRef.current = presenceChannel;
    }

    return () => {
      mounted = false;
      messagesLoadVersionRef.current += 1;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      try {
        typingChannel?.unsubscribe();
      } catch (err) {
        console.warn(err);
      }
      if (presenceChannelRef.current) {
        try {
          presenceChannelRef.current.unsubscribe();
        } catch (err) {
          console.warn(err);
        }
        presenceChannelRef.current = null;
      }
      if (conversationId && userId) {
        void leavePresence(conversationId, userId, presenceChannelRef.current ?? undefined);
      }
    };
  }, [conversationId, getCachedMessages, setCachedMessages, addMessageToCache, userId, recipientName]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      if (conversationId && userId && typingStateRef.current) {
        // ensure we announce stop-typing when leaving
        typingStateRef.current = false;
        void sendTypingIndicator(conversationId, userId, false);
      }
    };
  }, [conversationId, userId]);

  async function handleSend() {
    if ((!inputText.trim() && !selectedFile && !audioBlob)) return;

    if (authLoading) {
      setSendError("Please wait for your account to finish loading.");
      return;
    }

    if (!userId || !recipientId) {
      setSendError("You need to be signed in to send a message.");
      return;
    }

    // Stop typing indicator when sending
    if (conversationId && typingStateRef.current) {
      typingStateRef.current = false;
      void sendTypingIndicator(conversationId, userId, false);
    }
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    let resolvedConversationId = conversationId;
    if (!resolvedConversationId) {
      const createdConversation = await findOrCreateConversation(userId, recipientId);
      if (!createdConversation) {
        setSendError("This chat is still loading. Please wait a moment and try again.");
        return;
      }
      resolvedConversationId = createdConversation.id;
      setConversationId(createdConversation.id);
    }

    messagesLoadVersionRef.current += 1;
    setSendError(null);
    setIsLoading(true);
    setUploadProgress(0);

    let imageUrl: string | undefined;

    if (selectedFile) {
      try {
        const filePath = `${conversationId}/${selectedFile.lastModified}_${selectedFile.name}`;
        await uploadFileWithProgress(selectedFile, filePath, setUploadProgress);
        const { data: urlData } = supabase.storage.from("messages").getPublicUrl(filePath);
        imageUrl = urlData?.publicUrl ?? undefined;
        if (!imageUrl) {
          throw new Error("Failed to get file url");
        }
      } catch (err) {
        console.error("file upload error", err);
        alert("Failed to upload attachment");
        setIsLoading(false);
        setUploadProgress(0);
        return;
      }
    }

    let audioUrl: string | undefined;
    let optimisticAudioUrl: string | undefined;

    if (audioBlob) {
      // Create optimistic audio URL from blob immediately
      optimisticAudioUrl = URL.createObjectURL(audioBlob);
      
      try {
        const filePath = `${resolvedConversationId}/${createMessageId("audio")}.webm`;
        const { error } = await supabase.storage.from("messages").upload(filePath, audioBlob as Blob);
        if (error) {
          console.error(error);
          setIsLoading(false);
          setUploadProgress(0);
          return;
        }
        const { data } = supabase.storage.from("messages").getPublicUrl(filePath);
        audioUrl = data?.publicUrl ?? undefined;
        console.log("Chat - uploaded audio publicUrl:", audioUrl, "filePath:", filePath);
      } catch (err) {
        console.error("audio upload error", err);
        setIsLoading(false);
        setUploadProgress(0);
        return;
      }
    }

    console.log("Chat - calling sendMessage with:", { conversationId: resolvedConversationId, senderId: userId, text: inputText.trim() || undefined, imageUrl, audioUrl });

    // Create optimistic message for immediate display (works for all message types)
    const optimisticId = createMessageId("optimistic");
    const optimisticMessage: Message = {
      id: optimisticId,
      conversation_id: resolvedConversationId,
      sender_id: userId,
      text: inputText.trim() || undefined,
      image_url: imageUrl,
      audio_url: optimisticAudioUrl || audioUrl,
      created_at: new Date().toISOString(),
    };
    
    setMessages((current) => mergeMessages([...current, optimisticMessage]));
    // defer cache update to avoid updating context during render
    Promise.resolve().then(() => addMessageToCache(resolvedConversationId, optimisticMessage));

    const newMessage = await sendMessage({
      conversationId: resolvedConversationId,
      senderId: userId,
      text: inputText.trim() || undefined,
      imageUrl,
      audioUrl,
      replyToId: replyingTo?.id ?? null,
      replyToText: replyingTo?.text ?? null,
    });

    console.log("Chat - sendMessage returned:", newMessage);

    setIsLoading(false);
    setUploadProgress(0);

    if (newMessage) {
      // Replace optimistic message with real one
      setMessages((current) => {
        const filtered = current.filter((msg) => msg.id !== optimisticId);
        return mergeMessages([...filtered, newMessage]);
      });
      // defer cache update to avoid updating context during render
      Promise.resolve().then(() => addMessageToCache(resolvedConversationId, newMessage));
      
      // Update conversation's last activity timestamp to bubble it to the top of the list
      void updateConversationLastMessageTime(resolvedConversationId, newMessage.created_at);
      
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      
      // Revoke optimistic URL
      if (optimisticAudioUrl) {
        URL.revokeObjectURL(optimisticAudioUrl);
      }
      
      setSelectedFile(null);
      setInputText("");
      setPreviewUrl(null);
      setAudioBlob(null);
      setReplyingTo(null);
      setSendError(null);
    } else {
      setMessages((current) => current.filter((msg) => msg.id !== optimisticId));
      setReplyingTo(null);
      if (optimisticAudioUrl) {
        URL.revokeObjectURL(optimisticAudioUrl);
      }
      setSendError("Your message couldn’t be sent. Please try again.");
    }
  }

  const commonEmojis = ["😀", "😂", "❤️", "🔥", "👍", "🎉", "😍", "🤔", "😎", "💀", "🙏", "😢"];

  function formatRecordingTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function handleEmojiClick(emoji: string) {
    setInputText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  }

  function handleAttachmentClick() {
    fileInputRef.current?.click();
  }

  async function uploadFileWithProgress(
    file: File,
    path: string,
    onProgress: (value: number) => void
  ) {
    // Optimize images before uploading to reduce bandwidth
    let uploadBlob: Blob | File = file;
    try {
      if (file.type.startsWith("image/")) {
        const { optimizeImageFile } = await import("../lib/imageUtils");
        uploadBlob = await optimizeImageFile(file, 1200, 0.8);
      }
    } catch (e) {
      console.warn("Image optimization failed, uploading original file", e);
      uploadBlob = file;
    }

    const { data: signedData, error: signError } = await supabase
      .storage
      .from("messages")
      .createSignedUploadUrl(path);

    if (signError || !signedData?.signedUrl) {
      throw signError ?? new Error("Failed to create signed upload URL");
    }

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", signedData.signedUrl);
      if (uploadBlob && (uploadBlob as Blob).type) {
        xhr.setRequestHeader("Content-Type", (uploadBlob as Blob).type);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload failed"));
      xhr.send(uploadBlob);
    });
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(blob);
        try {
          const url = URL.createObjectURL(blob);
          setAudioPreviewUrl(url);
        } catch (err) {
          console.warn("audio preview creation failed", err);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
      }
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      setIsRecording(true);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied");
    }
  }

  function stopRecording() {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (err) {
      console.warn("stopping audio stream failed", err);
    }
    mediaStreamRef.current = null;
    setIsRecording(false);
  }

  function clearRecording() {
    if (audioPreviewUrl) {
      try {
        URL.revokeObjectURL(audioPreviewUrl);
      } catch (err) {
        console.warn("stopping audio stream failed", err);
      }
    }
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    if (!conversationId || !userId) {
      alert("Conversation not ready");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      // fallback: insert filename placeholder
      setInputText((prev) => prev + ` [📎 ${file.name}]`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // draw waveform when preview URL changes
  useEffect(() => {
    const url = audioPreviewUrl;
    const canvas = waveRef.current;
    if (!url || !canvas) return;

    let audioCtx: AudioContext | null = null;
    let cancelled = false;

    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((arrayBuffer) => {
        if (cancelled) return;
        const AudioContextConstructor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          return;
        }
        audioCtx = new AudioContextConstructor();
        return audioCtx.decodeAudioData(arrayBuffer);
      })
      .then((audioBuffer) => {
        if (cancelled || !audioBuffer) return;
        const rawData = audioBuffer.getChannelData(0);
        const canvasCtx = canvas.getContext("2d");
        if (!canvasCtx) return;
        const width = (canvas.width = Math.max(200, canvas.clientWidth));
        const height = (canvas.height = 40);
        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.fillStyle = "rgba(255,255,255,0.12)";
        const blockSize = Math.floor(rawData.length / width) || 1;
        for (let i = 0; i < width; i++) {
          let sum = 0;
          const start = i * blockSize;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(rawData[start + j] || 0);
          }
          const avg = sum / blockSize;
          const barHeight = Math.min(height, avg * height * 10);
          const y = (height - barHeight) / 2;
          canvasCtx.fillRect(i, y, 1, barHeight);
        }
      })
      .catch((err) => {
        console.warn("waveform err", err);
      })
      .finally(() => {
        if (audioCtx) {
          try {
            audioCtx.close();
          } catch (err) {
            console.warn("waveform cleanup failed", err);
          }
        }
      });

    return () => {
      cancelled = true;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (err) {
          console.warn("waveform cleanup failed", err);
        }
      }
    };
  }, [audioPreviewUrl]);

  function togglePlayPreview() {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (isPlaying) {
      audioEl.pause();
    } else {
      audioEl.play().catch(() => {});
    }
  }

  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audioEl.addEventListener("play", onPlay);
    audioEl.addEventListener("pause", onPause);
    audioEl.addEventListener("ended", onEnded);
    return () => {
      audioEl.removeEventListener("play", onPlay);
      audioEl.removeEventListener("pause", onPause);
      audioEl.removeEventListener("ended", onEnded);
    };
  }, []);

  const loadOlderMessagesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  async function loadOlderMessages() {
    if (!conversationId || !userId || isLoadingOlderMessages || !hasMoreMessages || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.created_at) return;

    setIsLoadingOlderMessages(true);
    const olderMessages = await fetchMessagesPage(conversationId, oldestMessage.created_at, 30);

    if (olderMessages.length === 0) {
      setHasMoreMessages(false);
      setIsLoadingOlderMessages(false);
      return;
    }

    setMessages((current) => {
      const merged = mergeMessages([...olderMessages, ...current]);
      setCachedMessages(conversationId, merged);
      return merged;
    });

    setHasMoreMessages(olderMessages.length >= 30);
    setIsLoadingOlderMessages(false);

    requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (container) {
        const previousHeight = container.scrollHeight;
        requestAnimationFrame(() => {
          const heightDelta = container.scrollHeight - previousHeight;
          container.scrollTop = heightDelta;
        });
      }
    });
  }

  loadOlderMessagesRef.current = loadOlderMessages;

  useEffect(() => {
    hasMoreMessagesRef.current = hasMoreMessages;
  }, [hasMoreMessages]);

  useEffect(() => {
    isLoadingOlderMessagesRef.current = isLoadingOlderMessages;
  }, [isLoadingOlderMessages]);

  // Detect when user scrolls manually
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

      if (container.scrollTop < 220 && hasMoreMessagesRef.current && !isLoadingOlderMessagesRef.current) {
        void loadOlderMessagesRef.current();
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
  }, [conversationId]);

  // Auto-scroll only if user is already at bottom or messages just loaded
  useEffect(() => {
    const previousCount = previousMessageCountRef.current;
    const messageCountChanged = previousCount !== messages.length;
    previousMessageCountRef.current = messages.length;

    const shouldAutoScroll = messageCountChanged && (isUserAtBottomRef.current || previousCount === 0) && !isLoadingOlderMessagesRef.current;

    if (shouldAutoScroll) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages]);

  async function handleEditMessage(messageId: string, newText: string) {
    if (!userId) return;
    const updated = await editMessage(messageId, newText, userId);
    if (updated) {
      setMessages((current) => mergeMessages(current.map(msg => msg.id === messageId ? updated : msg)));
      Promise.resolve().then(() => addMessageToCache(conversationId ?? "", updated));
    } else {
      alert("Failed to edit message. You can only edit your own messages.");
    }
  }

  async function handleDeleteMessage(messageId: string) {
    if (!userId) return;
    const success = await deleteMessage(messageId, userId);
    if (success) {
      setMessages((current) => current.filter(msg => msg.id !== messageId));
      if (conversationId) {
        Promise.resolve().then(() => {
          const cache = getCachedMessages(conversationId);
          if (cache) {
            const updated = cache.filter(msg => msg.id !== messageId);
            setCachedMessages(conversationId, updated);
          }
        });
      }
    } else {
      alert("Failed to delete message. You can only delete your own messages.");
    }
  }

  const shellClassName = isVibesPro
    ? "app-screen min-h-screen bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.18),transparent_35%),linear-gradient(135deg,#0B0B0B_0%,#141414_45%,#0F0F0F_100%)] flex flex-col relative overflow-hidden"
    : "app-screen min-h-screen bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.18),transparent_32%),radial-gradient(circle_at_bottom,rgba(129,140,248,0.16),transparent_40%),linear-gradient(135deg,#fdf2f8_0%,#f5e8ff_48%,#e0f2fe_100%)] flex flex-col relative overflow-hidden";

  const headerClassName = isVibesPro
    ? "fixed top-0 left-0 right-0 z-50 bg-[#111111]/95 p-3 md:p-6 border-b border-[#D4AF37]/20 shadow-[0_0_40px_rgba(212,175,55,0.12)]"
    : "fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl p-3 md:p-6 border-b border-white/70 shadow-[0_10px_35px_rgba(236,72,153,0.08)]";

  const headerCardClassName = isVibesPro
    ? "bg-[#181818]/90 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-[28px] p-3 shadow-[0_0_24px_rgba(212,175,55,0.12)] flex flex-col gap-3"
    : "bg-white/80 backdrop-blur-3xl border border-white/80 rounded-[28px] p-3 shadow-[0_10px_40px_rgba(168,85,247,0.12)] flex flex-col gap-3";

  const headerSubtextClassName = isVibesPro ? "text-[#EBD39A]/70" : "text-slate-600";
  const panelClassName = isVibesPro
    ? "rounded-2xl border border-[#D4AF37]/20 bg-[#181818]/80 px-3 py-2 backdrop-blur-xl"
    : "rounded-2xl border border-pink-100 bg-white/90 px-3 py-2 backdrop-blur-xl shadow-sm";

  const emptyStateClassName = isVibesPro
    ? "bg-[#181818]/80 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-4xl p-8 text-center text-[#EBD39A]/70 shadow-[0_0_30px_rgba(212,175,55,0.08)]"
    : "bg-white/80 backdrop-blur-3xl border border-pink-100 rounded-4xl p-8 text-center text-slate-700 shadow-[0_10px_35px_rgba(236,72,153,0.08)]";

  const messageBoxClassName = isVibesPro
    ? "bg-[#181818]/90 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-3xl md:rounded-4xl p-2 md:p-4 shadow-[0_0_30px_rgba(212,175,55,0.12)]"
    : "bg-white/80 backdrop-blur-3xl border border-pink-100 rounded-3xl md:rounded-4xl p-2 md:p-4 shadow-[0_10px_35px_rgba(168,85,247,0.12)]";

  const messagesSurfaceClassName = "flex-1 overflow-y-auto overflow-x-hidden pt-28 md:pt-32 pb-28 md:pb-32 px-3 md:px-6 bg-transparent";
  const backgroundOverlayClassName = isVibesPro
    ? "absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,215,0,0.10),transparent_30%)]"
    : "absolute inset-0 pointer-events-none z-0";

  const inputClassName = isVibesPro
    ? "w-full bg-transparent outline-none text-[#F7E7B2] placeholder-[#E8C96F]/50 text-sm md:text-base px-2 font-serif"
    : "w-full bg-transparent outline-none text-slate-900 placeholder-slate-500 text-sm md:text-base px-2";

  const sendButtonClassName = isVibesPro
    ? "bg-linear-to-r from-[#D4AF37] to-[#F0C75E] text-[#111111] h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-2xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center shrink-0 text-sm md:text-base active:scale-95"
    : "bg-linear-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-2xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center shrink-0 text-sm md:text-base active:scale-95";

  return (
    <div className={shellClassName}>
      {/* Paw Print Background */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
        viewBox="0 0 1200 1200"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="pawprints" x="0" y="0" width="300" height="300" patternUnits="userSpaceOnUse">
            {/* Big paw pad */}
            <circle cx="150" cy="200" r="30" fill="white" />
            {/* Four toe pads */}
            <circle cx="100" cy="100" r="18" fill="white" />
            <circle cx="150" cy="50" r="18" fill="white" />
            <circle cx="200" cy="100" r="18" fill="white" />
            <circle cx="150" cy="140" r="18" fill="white" />
          </pattern>
        </defs>
        <rect width="1200" height="1200" fill="url(#pawprints)" />
      </svg>

      {/* Paw Prints Scattered */}
      <svg
        className="absolute top-0 left-0 w-full h-full opacity-8 pointer-events-none"
        viewBox="0 0 1200 1200"
        preserveAspectRatio="none"
      >
        {/* Random paw prints */}
        <g transform="translate(100, 150) rotate(25)" fill="white">
          <circle cx="0" cy="40" r="25" />
          <circle cx="-35" cy="-20" r="15" />
          <circle cx="35" cy="-20" r="15" />
          <circle cx="0" cy="-50" r="15" />
          <circle cx="-15" cy="0" r="15" />
        </g>
        <g transform="translate(950, 300) rotate(45)" fill="white">
          <circle cx="0" cy="40" r="25" />
          <circle cx="-35" cy="-20" r="15" />
          <circle cx="35" cy="-20" r="15" />
          <circle cx="0" cy="-50" r="15" />
          <circle cx="-15" cy="0" r="15" />
        </g>
        <g transform="translate(200, 800) rotate(-20)" fill="white">
          <circle cx="0" cy="40" r="25" />
          <circle cx="-35" cy="-20" r="15" />
          <circle cx="35" cy="-20" r="15" />
          <circle cx="0" cy="-50" r="15" />
          <circle cx="-15" cy="0" r="15" />
        </g>
        <g transform="translate(800, 700) rotate(60)" fill="white">
          <circle cx="0" cy="40" r="25" />
          <circle cx="-35" cy="-20" r="15" />
          <circle cx="35" cy="-20" r="15" />
          <circle cx="0" cy="-50" r="15" />
          <circle cx="-15" cy="0" r="15" />
        </g>
        <g transform="translate(400, 400) rotate(-45)" fill="white">
          <circle cx="0" cy="40" r="25" />
          <circle cx="-35" cy="-20" r="15" />
          <circle cx="35" cy="-20" r="15" />
          <circle cx="0" cy="-50" r="15" />
          <circle cx="-15" cy="0" r="15" />
        </g>
      </svg>

      {/* Content Container - relative z-index to appear above paw prints */}
      <div className="relative z-10 flex-1">
        <div className={backgroundOverlayClassName} />

      {/* Fixed Header */}
      <div className={headerClassName}>
        <div className="max-w-xl mx-auto">
          <div className={headerCardClassName}>
            <div className="flex items-center gap-3">
              <Link
                to="/messages"
                className={`text-lg font-bold hover:scale-[1.05] transition ${isVibesPro ? 'text-white' : 'text-slate-800'}`}
              >
                ←
              </Link>

              <div className={`grid place-items-center w-10 h-10 rounded-[20px] ${isVibesPro ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E] text-[#111111]' : 'bg-linear-to-r from-fuchsia-500 via-violet-500 to-cyan-400 text-white'} font-bold text-sm`}>
                {recipientName.charAt(0)}
              </div>

              <div>
                <h2 
                  className={`font-semibold text-sm md:text-base cursor-pointer transition ${isVibesPro ? 'text-[#F7E7B2] hover:text-[#FFD98A]' : 'text-slate-800 hover:text-fuchsia-600'}`}
                  onClick={() => navigate(`/profile/${recipientName}`)}
                >
                  {recipientName}
                </h2>

                <p className={`text-xs mt-1 ${headerSubtextClassName}`}>
                  {typingUsers.includes(recipientId)
                    ? `${recipientName} is typing...`
                    : presenceState[recipientId]
                      ? "🟢 Online"
                      : "Online now"}
                </p>
              </div>

              {/* Call Buttons */}
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => alert(`Starting audio call with ${recipientName}`)}
                  title="Audio call"
                  className={`p-2 rounded-xl transition ${isVibesPro ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                >
                  📞
                </button>

                <button
                  onClick={() => alert(`Starting video call with ${recipientName}`)}
                  title="Video call"
                  className={`p-2 rounded-xl transition ${isVibesPro ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                >
                  🎥
                </button>
              </div>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${showSearchBar || searchQuery.trim() ? 'max-h-12 opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0'}`}>
              <div className={`${panelClassName}`}>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search this conversation"
                  className={`w-full bg-transparent text-sm outline-none ${isVibesPro ? 'text-[#F7E7B2] placeholder:text-[#E8C96F]/50 font-serif' : 'text-white placeholder:text-white/50'}`}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div ref={messagesContainerRef} className={`relative z-10 ${messagesSurfaceClassName}`}>
        <div className="max-w-xl mx-auto">
          {/* Messages */}
          {recipientId ? (
            <div className="space-y-4">
              {isLoadingOlderMessages && (
                <div className="text-center text-white/50 text-sm py-2">Loading older messages…</div>
              )}
              {messagesLoading ? (
                <div className="space-y-4 py-8">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="flex-1">
                        <div className="h-3 bg-white/10 rounded w-1/3 mb-2" />
                        <div className="h-8 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-white/50 py-8">
                  No messages yet. Start the conversation! 💬
                </div>
              ) : (() => {
                const filteredMessages = searchQuery.trim()
                  ? messages.filter((msg) => {
                      const text = `${msg.text ?? ""} ${msg.reply_to_text ?? ""}`.toLowerCase();
                      return text.includes(searchQuery.trim().toLowerCase());
                    })
                  : messages;

                if (filteredMessages.length === 0) {
                  return (
                    <div className={`text-center py-8 ${isVibesPro ? 'text-[#EBD39A]/70' : 'text-white/50'}`}>
                      No messages match your search. 🔎
                    </div>
                  );
                }

                return filteredMessages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    mine={msg.sender_id === userId}
                    message={msg}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    onReply={(message) => setReplyingTo(message)}
                  />
                ));
              })()}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className={emptyStateClassName}>
              Open a message thread or tap a profile message icon to start chatting.
            </div>
          )}

        </div>
      </div>

      {/* Fixed Message Box at Bottom */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 p-3 md:p-6 ${isVibesPro ? 'bg-[#111111]/95 border-t border-[#D4AF37]/20 shadow-[0_0_40px_rgba(212,175,55,0.10)]' : 'bg-white/70 backdrop-blur-xl border-t border-white/70 shadow-[0_-10px_35px_rgba(236,72,153,0.08)]'}`}>
        <div className="max-w-xl mx-auto">
          {replyingTo && (
            <div className={`mb-3 rounded-2xl border px-3 py-2 text-sm flex items-center justify-between ${isVibesPro ? 'border-white/10 bg-white/10 text-white/80' : 'border-pink-100 bg-white/90 text-slate-700 shadow-sm'}`}>
              <div className="min-w-0">
                <div className={`text-[11px] uppercase tracking-[0.2em] ${isVibesPro ? 'text-white/50' : 'text-slate-500'}`}>Replying to</div>
                <div className="truncate">{replyingTo.text ?? "message"}</div>
              </div>
              <button onClick={() => setReplyingTo(null)} className={`ml-2 rounded-full p-1 ${isVibesPro ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`} aria-label="Cancel reply">
                <X size={16} />
              </button>
            </div>
          )}
          {audioBlob ? (
            <div className="mb-3 p-3 rounded-2xl bg-white/10 flex items-center gap-3">
              <button
                onClick={togglePlayPreview}
                className={`h-9 w-9 rounded-full flex items-center justify-center ${isVibesPro ? 'bg-white/5 text-white' : 'bg-slate-900/10 text-slate-800'}`}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <div className="flex-1">
                <canvas ref={waveRef} className="w-full h-8" />
                <div className={`text-xs mt-1 ${isVibesPro ? 'text-white/70' : 'text-slate-600'}`}>Voice note ready</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearRecording}
                  className={`h-8 w-8 rounded-full flex items-center justify-center ${isVibesPro ? 'bg-slate-900/60 text-white' : 'bg-slate-900/10 text-slate-800'}`}
                  aria-label="Remove voice note"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <audio ref={audioRef} src={audioPreviewUrl ?? undefined} hidden />
            </div>
          ) : null}

          {previewUrl && selectedFile ? (
            <div className={`mb-3 rounded-[28px] backdrop-blur-3xl border shadow-lg overflow-hidden transition-opacity duration-300 ease-out opacity-100 ${isVibesPro ? 'bg-white/10 border-white/10' : 'bg-white/90 border-pink-100'}`}>
              <div className="relative">
                <img
                  src={previewUrl}
                  alt={selectedFile.name}
                  className="w-full max-h-50 object-contain bg-slate-950"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (previewUrlRef.current) {
                      URL.revokeObjectURL(previewUrlRef.current);
                      previewUrlRef.current = null;
                    }
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className={`absolute top-3 right-3 h-9 w-9 rounded-full shadow-lg transition shrink-0 ${isVibesPro ? 'bg-slate-900/80 text-white hover:bg-slate-800' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                >
                  ✕
                </button>
              </div>
              <div className={`px-4 py-3 text-sm ${isVibesPro ? 'text-white/80' : 'text-slate-700'}`}>
                {selectedFile.name}
              </div>
              {uploadProgress > 0 && isLoading ? (
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden mx-4 mb-3">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={messageBoxClassName}>
            {sendError ? (
              <div className="mb-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {sendError}
              </div>
            ) : null}

            <div className="flex gap-1 md:gap-2 items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAttachmentClick}
                  className={`h-10 w-10 rounded-full transition flex items-center justify-center shrink-0 ${isVibesPro ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                  title="Add attachment"
                >
                  <Paperclip className="h-4 w-4" />
                </button>

                {isRecording ? (
                  <button
                    onClick={stopRecording}
                    className="h-10 w-10 rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse flex items-center justify-center shrink-0"
                    title="Stop recording"
                  >
                    <Square className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={startRecording}
                    className={`h-10 w-10 rounded-full transition flex items-center justify-center shrink-0 ${isVibesPro ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                    title="Start recording"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex-1">
                {isRecording ? (
                  <div className="mb-2 flex items-center gap-2 rounded-full bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-200 border border-red-400/30 w-fit">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span>Recording • {formatRecordingTime(recordingDuration)}</span>
                  </div>
                ) : null}
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className={inputClassName}
                />
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`h-10 w-10 rounded-full transition flex items-center justify-center ${isVibesPro ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-900/10 text-slate-800 hover:bg-slate-900/20'}`}
                  title="Add emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 md:p-3 shadow-xl grid grid-cols-6 gap-1 md:gap-2 w-44 md:w-48 z-50">
                    {commonEmojis.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleEmojiClick(emoji)}
                        className="text-lg md:text-xl hover:scale-125 transition cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSend}
                disabled={isLoading || authLoading || !userId || !recipientId || !conversationId || (!inputText.trim() && !selectedFile && !audioBlob)}
                className={sendButtonClassName}
              >
                {isLoading ? (
                  <span className="hidden md:inline">Uploading... {uploadProgress}%</span>
                ) : (
                  <span className="hidden md:inline">Send</span>
                )}
                {isLoading ? (
                  <span className="md:hidden">{uploadProgress}%</span>
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />
      </div>

    </div>
  );
}