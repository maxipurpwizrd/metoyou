import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import { File } from "expo-file-system";
import { getRelativeTime } from "../../lib/time";
import { nativeSupabase } from "../lib/supabase";
import { uploadNativeCommentAudio } from "../lib/posts";
import NativeBlurBackdrop from "./NativeBlurBackdrop";
import NativeConfirmDialog from "./NativeConfirmDialog";

type NativeComment = {
  id: string;
  author_id: string;
  text: string | null;
  voice_url: string | null;
  created_at: string;
  profiles?: { username?: string | null; profile_pic?: string | null } | null;
};

type CommentLike = { liked: boolean; likes: number };
type CommentLikeState = Record<string, CommentLike>;
const COMMENT_LIKE_STORAGE_KEY = "metoyou-comment-like-state";

function NativeVoiceComment({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  return (
    <Pressable
      accessibilityLabel={status.playing ? "Pause voice comment" : "Play voice comment"}
      accessibilityRole="button"
      onPress={() => (status.playing ? player.pause() : player.play())}
      style={styles.voicePlayer}
    >
      <Text style={styles.voiceIcon}>{status.playing ? "Ⅱ" : "▶"}</Text>
      <Text style={styles.voiceLabel}>Voice comment</Text>
    </Pressable>
  );
}

export default function NativeCommentsSheet({
  postId,
  visible,
  onClose,
  onCountChange,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [comments, setComments] = useState<NativeComment[]>([]);
  const [text, setText] = useState("");
  const [voiceBase64, setVoiceBase64] = useState<string | null>(null);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [likeState, setLikeState] = useState<CommentLikeState>({});
  const [error, setError] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const onCountChangeRef = useRef(onCountChange);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderRef = useRef(recorder);
  const recordingRef = useRef(false);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  recorderRef.current = recorder;
  onCountChangeRef.current = onCountChange;

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: queryError }, { data: authData, error: authError }] = await Promise.all([
        nativeSupabase
          .from("comments")
          .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(username, profile_pic)")
          .eq("post_id", postId)
          .order("created_at", { ascending: true }),
        nativeSupabase.auth.getUser(),
      ]);
      if (queryError) throw queryError;
      if (authError) throw authError;
      const rows = (data ?? []) as NativeComment[];
      setComments(rows);
      setUserId(authData.user?.id ?? null);
      onCountChangeRef.current(rows.length);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load comments.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (visible) void loadComments();
  }, [loadComments, visible]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(COMMENT_LIKE_STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const stored: unknown = JSON.parse(raw);
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          setLikeState(stored as CommentLikeState);
        }
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Comment likes could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, []);

  const updateCountBestEffort = async (delta: number, successMessage: string) => {
    try {
      const { data: post, error: postError } = await nativeSupabase
        .from("posts")
        .select("comments_count")
        .eq("id", postId)
        .maybeSingle();
      if (postError) throw postError;
      const { error: updateError } = await nativeSupabase
        .from("posts")
        .update({ comments_count: Math.max(0, Number(post?.comments_count ?? 0) + delta) })
        .eq("id", postId);
      if (updateError) throw updateError;
    } catch (cause) {
      const detail = cause instanceof Error ? ` ${cause.message}` : "";
      setError(`${successMessage}; the displayed comment count may take time to update.${detail}`);
    }
  };

  const stopRecording = async () => {
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
    recordingInterval.current = null;
    recordingTimeout.current = null;
    if (!recordingRef.current) return;
    recordingRef.current = false;
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("The voice recording could not be saved.");
      const base64 = await new File(uri).base64();
      setVoiceUri(uri);
      setVoiceBase64(base64);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save the voice recording.");
    } finally {
      setRecording(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("Allow microphone access to record a voice comment.");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setRecordingSeconds(0);
      setRecording(true);
      recordingInterval.current = setInterval(() => setRecordingSeconds((current) => current + 1), 1000);
      recordingTimeout.current = setTimeout(() => void stopRecording(), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start voice recording.");
    }
  };

  useEffect(() => {
    return () => {
      if (recordingInterval.current) clearInterval(recordingInterval.current);
      if (recordingTimeout.current) clearTimeout(recordingTimeout.current);
      if (recordingRef.current) {
        recordingRef.current = false;
        void recorderRef.current.stop();
      }
    };
  }, []);

  const addComment = async () => {
    const commentText = text.trim();
    if ((!commentText && !voiceBase64) || sending || !userId) return;
    setSending(true);
    setError(null);
    try {
      let voiceUrl: string | null = null;
      if (voiceBase64) {
        voiceUrl = await uploadNativeCommentAudio({
          authorId: userId,
          base64: voiceBase64,
          mimeType: "audio/mp4",
        });
      }
      const { data, error: insertError } = await nativeSupabase
        .from("comments")
        .insert({
          post_id: postId,
          author_id: userId,
          text: commentText || null,
          voice_url: voiceUrl,
          created_at: new Date().toISOString(),
        })
        .select("id, post_id, author_id, text, voice_url, created_at, profiles!comments_author_id_fkey(username, profile_pic)")
        .single();
      if (insertError) throw insertError;
      const nextComments = [...comments, data as NativeComment];
      setComments(nextComments);
      setText("");
      setVoiceBase64(null);
      setVoiceUri(null);
      onCountChangeRef.current(nextComments.length);
      await updateCountBestEffort(1, "Your comment was posted");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add your comment.");
    } finally {
      setSending(false);
    }
  };

  const saveCommentEdit = async (commentId: string) => {
    if (!editingText.trim()) {
      setError("Comment text cannot be empty.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const { data, error: updateError } = await nativeSupabase
        .from("comments")
        .update({ text: editingText.trim() })
        .eq("id", commentId)
        .eq("author_id", userId ?? "")
        .select("id, text")
        .single();
      if (updateError) throw updateError;
      setComments((current) =>
        current.map((comment) => comment.id === commentId ? { ...comment, text: data.text } : comment),
      );
      setEditingCommentId(null);
      setEditingText("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to edit this comment.");
    } finally {
      setSending(false);
    }
  };

  const deleteComment = (commentId: string) => setCommentToDelete(commentId);

  const confirmDeleteComment = async () => {
    if (!commentToDelete) return;
    setError(null);
    const commentId = commentToDelete;
    const { error: deleteError } = await nativeSupabase
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("author_id", userId ?? "");
    if (deleteError) throw deleteError;
    setComments((current) => {
      const next = current.filter((comment) => comment.id !== commentId);
      onCountChangeRef.current(next.length);
      return next;
    });
    await updateCountBestEffort(-1, "Your comment was deleted");
  };

  const toggleCommentLike = async (commentId: string) => {
    const current = likeState[commentId] ?? { liked: false, likes: 0 };
    const nextLikeState = {
      ...likeState,
      [commentId]: {
        liked: !current.liked,
        likes: Math.max(0, current.likes + (current.liked ? -1 : 1)),
      },
    };
    try {
      await AsyncStorage.setItem(COMMENT_LIKE_STORAGE_KEY, JSON.stringify(nextLikeState));
      setLikeState(nextLikeState);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this like.");
    }
  };

  const formatDuration = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <>
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <NativeBlurBackdrop intensity={18} overlayColor="rgba(2,32,54,0.42)" />
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Comments</Text>
              <Text style={styles.subtitle}>{comments.length} in this conversation</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#0284c7" />
            </View>
          ) : error && comments.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadComments()} style={styles.retry}>
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(comment) => comment.id}
              ListEmptyComponent={<Text style={styles.empty}>No comments yet. Start the conversation.</Text>}
              renderItem={({ item }) => {
                const itemLike = likeState[item.id] ?? { liked: false, likes: 0 };
                const isCommentOwner = item.author_id === userId;
                return (
                  <View style={styles.comment}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentInitial}>
                        {(item.profiles?.username || item.author_id).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentMeta}>
                        <Text numberOfLines={1} style={styles.username}>
                          {item.profiles?.username || item.author_id}
                        </Text>
                        <Text style={styles.time}>{getRelativeTime(item.created_at)}</Text>
                        {isCommentOwner ? (
                          <View style={styles.commentActions}>
                            <Pressable
                              accessibilityLabel="Edit comment"
                              onPress={() => {
                                setEditingCommentId(item.id);
                                setEditingText(item.text ?? "");
                              }}
                            >
                              <Text style={styles.smallAction}>Edit</Text>
                            </Pressable>
                            <Pressable accessibilityLabel="Delete comment" onPress={() => deleteComment(item.id)}>
                              <Text style={[styles.smallAction, styles.deleteText]}>Delete</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                      {editingCommentId === item.id ? (
                        <View style={styles.editArea}>
                          <TextInput
                            accessibilityLabel="Edit comment text"
                            editable={!sending}
                            multiline
                            onChangeText={setEditingText}
                            style={styles.editInput}
                            value={editingText}
                          />
                          <View style={styles.editButtons}>
                            <Pressable disabled={sending} onPress={() => void saveCommentEdit(item.id)} style={styles.saveEditButton}>
                              <Text style={styles.saveEditText}>Save</Text>
                            </Pressable>
                            <Pressable onPress={() => setEditingCommentId(null)} style={styles.cancelEditButton}>
                              <Text style={styles.cancelEditText}>Cancel</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : item.text ? (
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator
                          style={styles.commentTextScroll}
                        >
                          <Text style={styles.commentText}>{item.text}</Text>
                        </ScrollView>
                      ) : null}
                      {item.voice_url ? <NativeVoiceComment uri={item.voice_url} /> : null}
                      <Pressable
                        accessibilityLabel={`${itemLike.liked ? "Unlike" : "Like"} comment, ${itemLike.likes} likes`}
                        accessibilityRole="button"
                        onPress={() => void toggleCommentLike(item.id)}
                        style={styles.likeComment}
                      >
                        <Text style={styles.likeCommentText}>
                          {itemLike.liked ? "❤️" : "🤍"} {itemLike.likes}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {error && comments.length > 0 ? <Text style={styles.inlineError}>{error}</Text> : null}
          {recording ? (
            <View style={styles.recordingRow}>
              <Text style={styles.recordingText}>Recording {formatDuration(recordingSeconds)} / 01:00</Text>
              <Pressable accessibilityRole="button" onPress={() => void stopRecording()} style={styles.stopRecording}>
                <Text style={styles.stopRecordingText}>Stop</Text>
              </Pressable>
            </View>
          ) : voiceBase64 && voiceUri ? (
            <View style={styles.recordedRow}>
              <NativeVoiceComment uri={voiceUri} />
              <Pressable accessibilityRole="button" onPress={() => { setVoiceBase64(null); setVoiceUri(null); }}>
                <Text style={styles.removeVoice}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <Pressable
              accessibilityLabel={recording ? "Stop recording voice comment" : "Record voice comment"}
              accessibilityRole="button"
              disabled={sending}
              onPress={() => void (recording ? stopRecording() : startRecording())}
              style={[styles.recordButton, recording && styles.recordingActive]}
            >
              <Text style={styles.recordButtonText}>{recording ? "■" : "🎙"}</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Write a comment"
              editable={!sending && !recording}
              maxLength={1000}
              multiline
              onChangeText={setText}
              onSubmitEditing={() => void addComment()}
              placeholder="Write a comment…"
              placeholderTextColor="#94a3b8"
              returnKeyType="send"
              style={styles.input}
              value={text}
            />
            <Pressable
              accessibilityRole="button"
              disabled={sending || recording || (!text.trim() && !voiceBase64)}
              onPress={() => void addComment()}
              style={({ pressed }) => [
                styles.sendButton,
                pressed && styles.pressed,
                (sending || recording || (!text.trim() && !voiceBase64)) && styles.disabled,
              ]}
            >
              {sending ? <ActivityIndicator color="#ffffff" size="small" /> : <Text style={styles.sendText}>Send</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <NativeConfirmDialog
      confirmLabel="Delete"
      destructive
      emoji="🧹"
      message="This little comment will be removed for good."
      onCancel={() => setCommentToDelete(null)}
      onConfirm={confirmDeleteComment}
      title="Delete this comment?"
      visible={commentToDelete !== null}
    />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { height: "82%", paddingTop: 15, paddingHorizontal: 18, paddingBottom: 16, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f8fdff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  title: { color: "#082f49", fontSize: 19, fontWeight: "900" },
  subtitle: { marginTop: 3, color: "#64748b", fontSize: 12 },
  closeButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  closeText: { color: "#64748b", fontSize: 27 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  error: { color: "#be123c", fontSize: 14, textAlign: "center" },
  inlineError: { marginVertical: 6, color: "#be123c", fontSize: 12 },
  retry: { marginTop: 12, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, backgroundColor: "#0284c7" },
  retryText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  empty: { marginTop: 28, color: "#64748b", fontSize: 14, textAlign: "center" },
  comment: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dbe5ee",
    borderRadius: 14,
    backgroundColor: "#ffffff",
  },
  commentAvatar: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#0ea5e9" },
  commentInitial: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  commentBody: { flex: 1 },
  commentMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentActions: { flexDirection: "row", gap: 10, marginLeft: "auto" },
  username: { flexShrink: 1, color: "#334155", fontSize: 13, fontWeight: "800" },
  time: { color: "#94a3b8", fontSize: 10 },
  smallAction: { color: "#0284c7", fontSize: 11, fontWeight: "700" },
  deleteText: { color: "#e11d48" },
  commentTextScroll: { maxHeight: 240, marginTop: 4 },
  commentText: { color: "#475569", fontSize: 14, lineHeight: 20 },
  editArea: { marginTop: 6, gap: 7 },
  editInput: { minHeight: 65, padding: 9, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, color: "#334155", backgroundColor: "#ffffff", textAlignVertical: "top" },
  editButtons: { flexDirection: "row", gap: 8 },
  saveEditButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: "#0284c7" },
  saveEditText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  cancelEditButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: "#e2e8f0" },
  cancelEditText: { color: "#475569", fontSize: 11, fontWeight: "700" },
  likeComment: { alignSelf: "flex-start", marginTop: 5, paddingVertical: 3 },
  likeCommentText: { color: "#0284c7", fontSize: 11, fontWeight: "700" },
  voicePlayer: { flexDirection: "row", alignItems: "center", gap: 9, alignSelf: "flex-start", marginTop: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, backgroundColor: "#e0f2fe" },
  voiceIcon: { color: "#0369a1", fontSize: 14, fontWeight: "900" },
  voiceLabel: { color: "#0369a1", fontSize: 12, fontWeight: "700" },
  recordingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: "#fff1f2" },
  recordingText: { color: "#be123c", fontSize: 12, fontWeight: "700" },
  stopRecording: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 12, backgroundColor: "#e11d48" },
  stopRecordingText: { color: "#ffffff", fontSize: 12, fontWeight: "800" },
  recordedRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  removeVoice: { color: "#64748b", fontSize: 12, fontWeight: "700" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingTop: 12 },
  recordButton: { width: 43, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#e0f2fe" },
  recordingActive: { backgroundColor: "#ffe4e6" },
  recordButtonText: { color: "#0369a1", fontSize: 18, fontWeight: "800" },
  input: { flex: 1, maxHeight: 100, minHeight: 45, paddingHorizontal: 13, paddingVertical: 10, borderWidth: 1, borderColor: "#dbeafe", borderRadius: 15, color: "#334155", backgroundColor: "#ffffff", textAlignVertical: "top" },
  sendButton: { minWidth: 58, height: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#0284c7" },
  sendText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.5 },
});
