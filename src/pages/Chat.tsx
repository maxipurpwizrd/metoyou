import { useState, useEffect, useRef } from "react";
import type { RealtimeChannel, User } from "@supabase/supabase-js";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Mic, Paperclip, Send, Smile, Square, X, Pause, Play } from "lucide-react";
import ChatBubble from "../components/ChatBubble";
import { VibesProChat } from "../components/VibesPro";
import type { VibesProMessage as VibesProMessageType } from "../components/VibesPro/types";
import { useAuth } from "../hooks/useAuth";
import { useChat } from "../contexts/ChatContext";
import { supabase } from "../lib/supabase";
import {
  sendMessage,
  fetchMessages,
  findOrCreateConversation,
  subscribeToMessages,
  sendTypingIndicator,
  subscribeToTyping,
  joinPresence,
  leavePresence,
  subscribeToPresence,
  type Message,
} from "../lib/messageApi";

type AuthUserWithVibesFlag = (User | null | undefined) & {
  is_vibes_pro?: boolean;
  user_metadata?: { is_vibes_pro?: boolean };
  app_metadata?: { is_vibes_pro?: boolean };
};

export default function Chat() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { getCachedMessages, setCachedMessages, addMessageToCache } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const waveRef = useRef<HTMLCanvasElement | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const [presenceState, setPresenceState] = useState<Record<string, { last_active?: number; username?: string }>>({});
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const recipientId = searchParams.get("recipient") ?? "";
  const recipientName = searchParams.get("username") ?? "Friend";
  const userId = user?.id;
  const isVibesProUser =
    (user as AuthUserWithVibesFlag | null | undefined)?.is_vibes_pro === true ||
    (user as AuthUserWithVibesFlag | null | undefined)?.user_metadata?.is_vibes_pro === true ||
    (user as AuthUserWithVibesFlag | null | undefined)?.app_metadata?.is_vibes_pro === true;

  useEffect(() => {
    if (!userId || !recipientId) {
      setConversationId(null);
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

    const load = async () => {
      // Check if we have cached messages first
      const cached = getCachedMessages(conversationId);
      if (cached && cached.length > 0) {
        if (!mounted) return;
        setMessages(cached);
      }

      // Fetch fresh messages from server
      const msgs = await fetchMessages(conversationId);
      if (!mounted) return;
      setMessages(msgs);
      setCachedMessages(conversationId, msgs);
    };

    load();

    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    subscriptionRef.current = subscribeToMessages(conversationId, (newMessage) => {
      console.log("Chat - realtime newMessage received:", newMessage);
      setMessages((current) => {
        if (current.some((message) => message.id === newMessage.id)) {
          return current;
        }
        return [...current, newMessage];
      });
      // defer cache update to avoid updating context during render
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
      void joinPresence(conversationId, userId, { username: recipientName }).then((channel) => {
        presenceChannelRef.current = channel;
        if (channel) {
          const presenceSubscription = subscribeToPresence(conversationId, (state) => {
            setPresenceState(state);
          });
          try {
            presenceSubscription.unsubscribe();
          } catch (err) {
            console.warn(err);
          }
        }
      });
    }

    return () => {
      mounted = false;
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
        void leavePresence(conversationId, userId);
      }
    };
  }, [conversationId, getCachedMessages, setCachedMessages, addMessageToCache, userId, recipientName]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (conversationId && userId) {
        // ensure we announce stop-typing when leaving
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

    if (!conversationId) {
      setSendError("This chat is still loading. Please wait a moment and try again.");
      return;
    }

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
        const filePath = `${conversationId}/${Date.now()}.webm`;
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

    console.log("Chat - calling sendMessage with:", { conversationId, senderId: userId, text: inputText.trim() || undefined, imageUrl, audioUrl });

    // Add optimistic message immediately if audio
    const optimisticId = `optimistic-${Date.now()}`;
    if (audioBlob && optimisticAudioUrl) {
      const optimisticMessage: Message = {
        id: optimisticId,
        conversation_id: conversationId,
        sender_id: userId,
        text: inputText.trim() || undefined,
        audio_url: optimisticAudioUrl,
        created_at: new Date().toISOString(),
      };
      
      setMessages((current) => [...current, optimisticMessage]);
      // defer cache update to avoid updating context during render
      Promise.resolve().then(() => addMessageToCache(conversationId, optimisticMessage));
    }

    const newMessage = await sendMessage({
      conversationId,
      senderId: userId,
      text: inputText.trim() || undefined,
      imageUrl,
      audioUrl,
    });

    console.log("Chat - sendMessage returned:", newMessage);

    setIsLoading(false);
    setUploadProgress(0);

    if (newMessage) {
      // Replace optimistic message with real one
      setMessages((current) => {
        const filtered = current.filter((msg) => msg.id !== optimisticId);
        if (filtered.some((message) => message.id === newMessage.id)) {
          return filtered;
        }
        return [...filtered, newMessage];
      });
      // defer cache update to avoid updating context during render
      Promise.resolve().then(() => addMessageToCache(conversationId, newMessage));
      
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
      setSendError(null);
    } else {
      setMessages((current) => current.filter((msg) => msg.id !== optimisticId));
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
      if (file.type) {
        xhr.setRequestHeader("Content-Type", file.type);
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
      xhr.send(file);
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
        } catch (e) {}
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
    } catch (e) {
      // ignore
    }
    mediaStreamRef.current = null;
    setIsRecording(false);
  }

  function clearRecording() {
    if (audioPreviewUrl) {
      try {
        URL.revokeObjectURL(audioPreviewUrl);
      } catch (e) {
        // ignore
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
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
          } catch (e) {}
        }
      });

    return () => {
      cancelled = true;
      if (audioCtx) {
        try {
          audioCtx.close();
        } catch (e) {}
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

  const vibesProMessages: VibesProMessageType[] = messages.map((msg) => ({
    id: msg.id,
    text: msg.text ?? "",
    role: msg.sender_id === userId ? "user" : "assistant",
    createdAt: msg.created_at ?? undefined,
  }));

  if (isVibesProUser) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-800 via-slate-700 to-blue-900 p-4 md:p-6">
        <div className="mx-auto max-w-3xl">
          <VibesProChat
            messages={vibesProMessages}
            currentUserId={userId ?? ""}
            onSend={(text) => {
              if (!text.trim() || !userId || !recipientId || !conversationId) return;
              void sendMessage({
                conversationId,
                senderId: userId,
                text: text.trim(),
              }).then((newMessage) => {
                if (!newMessage) return;
                setMessages((current) => {
                  const filtered = current.filter((msg) => msg.id !== newMessage.id);
                  if (filtered.some((message) => message.id === newMessage.id)) {
                    return filtered;
                  }
                  return [...filtered, newMessage];
                });
                Promise.resolve().then(() => addMessageToCache(conversationId, newMessage));
              });
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-800 via-slate-700 to-blue-900 flex flex-col relative overflow-hidden">
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
      <div className="relative z-10">

      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-linear-to-br from-slate-800 via-slate-700 to-blue-900 p-3 md:p-6 border-b border-white/20">
        <div className="max-w-xl mx-auto">
          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[28px] p-3 shadow-sm flex items-center gap-3">

            <Link
              to="/messages"
              className="text-lg font-bold text-white hover:scale-[1.05] transition"
            >
              ←
            </Link>

            <div className="grid place-items-center w-10 h-10 rounded-[20px] bg-linear-to-r from-cyan-400 to-blue-500 text-white font-bold text-sm">
              {recipientName.charAt(0)}
            </div>

            <div>
              <h2 
                className="font-semibold text-sm md:text-base text-white cursor-pointer hover:text-cyan-300 transition"
                onClick={() => navigate(`/profile/${recipientName}`)}
              >
                {recipientName}
              </h2>

              <p className="text-xs text-white/60 mt-1">
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
                className="bg-white/5 text-white p-2 rounded-xl hover:bg-white/10 transition"
              >
                📞
              </button>

              <button
                onClick={() => alert(`Starting video call with ${recipientName}`)}
                title="Video call"
                className="bg-white/5 text-white p-2 rounded-xl hover:bg-white/10 transition"
              >
                🎥
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto pt-28 md:pt-32 pb-28 md:pb-32 px-3 md:px-6">
        <div className="max-w-xl mx-auto">

          {/* Messages */}
          {recipientId ? (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-white/50 py-8">
                  No messages yet. Start the conversation! 💬
                </div>
              ) : (
                messages.map((msg) => (
                  <ChatBubble
                    key={msg.id}
                    mine={msg.sender_id === userId}
                    message={msg}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-4xl p-8 text-center text-white/60 shadow-lg">
              Open a message thread or tap a profile message icon to start chatting.
            </div>
          )}

        </div>
      </div>

      {/* Fixed Message Box at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-linear-to-br from-slate-800 via-slate-700 to-blue-900 p-3 md:p-6 border-t border-white/20">
        <div className="max-w-xl mx-auto">
          {audioBlob ? (
            <div className="mb-3 p-3 rounded-2xl bg-white/10 flex items-center gap-3">
              <button
                onClick={togglePlayPreview}
                className="h-9 w-9 rounded-full bg-white/5 text-white flex items-center justify-center"
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>

              <div className="flex-1">
                <canvas ref={waveRef} className="w-full h-8" />
                <div className="text-xs text-white/70 mt-1">Voice note ready</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearRecording}
                  className="h-8 w-8 rounded-full bg-slate-900/60 text-white flex items-center justify-center"
                  aria-label="Remove voice note"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <audio ref={audioRef} src={audioPreviewUrl ?? undefined} hidden />
            </div>
          ) : null}

          {previewUrl && selectedFile ? (
            <div className="mb-3 rounded-[28px] bg-white/10 backdrop-blur-3xl border border-white/10 shadow-lg overflow-hidden transition-opacity duration-300 ease-out opacity-100">
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
                  className="absolute top-3 right-3 h-9 w-9 rounded-full bg-slate-900/80 text-white shadow-lg hover:bg-slate-800 transition shrink-0"
                >
                  ✕
                </button>
              </div>
              <div className="px-4 py-3 text-sm text-white/80">
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

          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-3xl md:rounded-4xl p-2 md:p-4 shadow-2xl">
            {sendError ? (
              <div className="mb-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {sendError}
              </div>
            ) : null}

            <div className="flex gap-1 md:gap-2 items-center">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAttachmentClick}
                  className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center shrink-0"
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
                    className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center shrink-0"
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputText(val);
                    if (!conversationId || !userId) return;
                    void sendTypingIndicator(conversationId, userId, true);
                    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = window.setTimeout(() => {
                      void sendTypingIndicator(conversationId!, userId!, false);
                      typingTimeoutRef.current = null;
                    }, 1200) as unknown as number;
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  className="w-full bg-transparent outline-none text-white placeholder-white/40 text-sm md:text-base px-2"
                />
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20 transition flex items-center justify-center"
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
                className="bg-linear-to-r from-cyan-500 to-blue-600 text-white h-10 w-10 md:w-auto md:px-4 rounded-full md:rounded-2xl font-bold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center shrink-0 text-sm md:text-base active:scale-95"
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