import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ImageViewer from "./ImageViewer";
import { getProfile } from "../utils/profileStorage";
import { useAutoplayVideo } from "../hooks/useAutoplayVideo";
import { useAutoplayAudio } from "../hooks/useAutoplayAudio";
import { useVideoContext } from "../contexts/VideoContext";
import type { Comment, User } from "../contexts/FeedContext";

type Props = {
  author: User;
  postId?: string | number;
  authorId?: string;
  time: string;
  text: string;
  image?: string;
  video?: string;

  comments?: Comment[];
  likes: number;
  liked?: boolean;
  highlighted?: boolean;

  onDeletePost?: () => void;
  onRetryPost?: () => void;
  onEditPost?: () => void;
  onDeleteImage?: () => void;
  onDeleteVideo?: () => void;

  isSelected?: boolean;
  onToggleLike?: () => void;
  onSelectPost?: () => void;
  onClosePost?: () => void;
  onRepost?: () => void;
  onSavePost?: () => void;
  onMuteUser?: () => void;
  onHighlight?: () => void;

  audio?: string;
  uploadState?: "uploading" | "completed" | "waiting-network" | "failed";
  uploadProgress?: number;
  onAddComment?: (comment: { id: number; text?: string; voice?: string }) => void;
  onDeleteComment?: (commentId: number) => void;
  onEditComment?: (commentId: number, newText: string) => void;
  onLikeComment?: (commentId: number) => void;
};

export default function PostCard({
  author,
  postId,
  authorId,
  time,
  text,
  image,
  video,
  comments,
  likes,
  liked = false,
  highlighted = false,
  isSelected = false,
  onToggleLike,
  onSelectPost,
  onClosePost,
  onRepost,
  onSavePost,
  onMuteUser,
  onDeletePost,
  onRetryPost,
  onEditPost,
  onDeleteImage,
  onDeleteVideo,
  onHighlight,
  audio,
  uploadState,
  uploadProgress,
  onAddComment,
  onDeleteComment,
  onEditComment,
  onLikeComment,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = getProfile();
  const ownerId = authorId ?? author?.id;
  const isOwner = Boolean(currentUser && ownerId && currentUser.id === ownerId);

  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [voiceComment, setVoiceComment] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Video autoplay state
  const [isMuted, setIsMuted] = useState(true);
  const { playingVideoId, setPlayingVideoId } = useVideoContext();

  const videoElementId = `video_${postId}`;
  const audioElementId = `audio_${postId}`;

  const videoRef = useAutoplayVideo({
    videoId: videoElementId,
    onVisibilityChange: (isVisible) => {
      if (isVisible && video) {
        setPlayingVideoId(videoElementId);
      } else if (playingVideoId === videoElementId) {
        setPlayingVideoId(null);
      }
    },
    threshold: 0.5,
  });

  const audioRef = useAutoplayAudio({
    audioId: audioElementId,
    threshold: 0.6,
    onVisibilityChange: () => undefined,
  });

  const hasVisualMedia = Boolean(image || video);
  const showMedia = Boolean(image || video || audio);

  useEffect(() => {
    const onScroll = () => setShowMenu(false);
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setShowMenu(false);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousedown", onDocClick);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setShowMenu(false), 0);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const audioUrl = URL.createObjectURL(blob);
        setVoiceComment(audioUrl);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      alert("Microphone permission denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  return (
    <div
      className={`bg-white/70 backdrop-blur-sm border border-white/40 rounded-[28px] shadow-sm p-4 mb-4 transition-all duration-300 ${
        isSelected ? "shadow-lg ring-1 ring-purple-200/50" : "hover:bg-white/80"
      } md:backdrop-blur-md md:rounded-3xl md:shadow-xs md:p-5`}
    >
      <div className="transition-all duration-300" style={{ opacity: uploadState === "uploading" ? 0.6 : 1 }}>
      {/* Header Container */}
      <div className="flex items-center justify-between mb-4">
        {/* Author Left Info Column */}
        <div className="flex items-center gap-3 min-w-0">
          {author.avatar ? (
            <img
              src={author.avatar}
              alt={author.username}
              className="w-10 h-10 rounded-xl object-cover shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-pink-400 via-purple-400 to-blue-400 shrink-0 shadow-xs"></div>
          )}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h3
                onClick={() => navigate(`/profile/${author.username}`)}
                className="font-bold text-sm text-slate-800 cursor-pointer hover:text-pink-500 transition-colors truncate"
              >
                {author.username}
              </h3>
              <span className="text-[11px] text-slate-400 font-medium shrink-0">{time}</span>
            </div>
            {highlighted && (
              <span className="inline-block text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 rounded-md px-1.5 py-0.5 mt-0.5">
                ✨ Highlight
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Options Button Menu - Floats Right */}
        <div className="relative shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
          >
            ⋯
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              onMouseDown={(e) => e.stopPropagation()}
              className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-slate-100 shadow-xl text-xs font-semibold text-slate-600 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
            >
              {isOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEditPost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    ✏️ Edit Post
                  </button>

                  {image && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteImage?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      🗑️ Delete Image
                    </button>
                  )}

                  {video && (
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteVideo?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      🗑️ Delete Video
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onHighlight?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-amber-600"
                  >
                    {highlighted ? "✨ Unhighlight" : "✨ Highlight"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onDeletePost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-500 transition-colors border-t border-slate-50"
                  >
                    🗑️ Delete Post
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.share({ title: `${author.username}'s post`, text, url: window.location.href });
                      } catch (err) {
                        console.warn(err);
                      }
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    📤 Share
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onRepost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    🔁 Repost
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSavePost?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
                  >
                    💾 Save Post
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onMuteUser?.();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors text-slate-500"
                  >
                    🔕 Mute User
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      alert("Report submitted. Thanks for helping keep MeToYou safe.");
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-500 transition-colors border-t border-slate-50"
                  >
                    🚩 Report
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/post/${postId ?? ownerId}`);
                  alert("Link copied!");
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-t border-slate-50"
              >
                🔗 Copy Link
              </button>
            </div>
          )}
        </div>
      </div>

      {uploadState && (
        <div className="mb-3 rounded-2xl border border-white/50 bg-white/80 px-3 py-2.5 shadow-sm">
          {uploadState === "uploading" && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                <span>Uploading... {uploadProgress ?? 0}%</span>
                <span className="text-[10px] uppercase tracking-wide text-pink-500">Live</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-300" style={{ width: `${Math.max(4, uploadProgress ?? 0)}%` }} />
              </div>
            </div>
          )}
          {uploadState === "completed" && (
            <div className="text-[11px] font-semibold text-emerald-600">✓ Upload complete</div>
          )}
          {uploadState === "waiting-network" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-600">
                <span>⚠</span>
                <span>Waiting for network...</span>
              </div>
              <p className="text-[10px] text-slate-500">Will continue automatically</p>
            </div>
          )}
          {uploadState === "failed" && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-red-600">Upload failed</span>
              <button type="button" onClick={(e)=>{e.stopPropagation(); onRetryPost?.();}} className="rounded-full bg-pink-500 px-2.5 py-1 text-[10px] font-semibold text-white">Retry</button>
              <button type="button" onClick={(e)=>{e.stopPropagation(); onDeletePost?.();}} className="rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-700">Delete</button>
            </div>
          )}
        </div>
      )}

      {/* Primary Layout Block Container */}
      {showMedia ? (
        <div className="flex flex-col md:flex-col gap-3.5">
          {hasVisualMedia ? (
            <div className="flex md:flex-col gap-3 md:gap-3.5">
              {/* LEFT: Media Container (45% on mobile, full width on desktop) */}
              <div className="w-[45%] md:w-full shrink-0 rounded-2xl bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 flex items-center justify-center overflow-hidden relative shadow-inner border border-white/20">
                {video ? (
                  <>
                    <video
                      ref={videoRef}
                      src={video}
                      muted={isMuted}
                      playsInline
                      className="w-full h-full object-contain bg-black/5"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsMuted(!isMuted);
                      }}
                      className="absolute bottom-2 right-2 bg-black/40 hover:bg-black/60 text-white rounded-full w-7 h-7 md:w-9 md:h-9 flex items-center justify-center text-xs md:text-sm transition-colors backdrop-blur-md z-10"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? "🔇" : "🔊"}
                    </button>
                  </>
                ) : (
                  <img
                    src={image}
                    alt={`${author.username}'s post`}
                    className="w-full h-full object-contain bg-black/5 cursor-pointer active:scale-98 transition-transform"
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewerIndex(0);
                      onClosePost?.();
                      setViewerOpen(true);
                    }}
                  />
                )}

                {audio && image && !video && (
                  <div className="absolute bottom-2 left-2 right-2 rounded-xl border border-white/40 bg-white/80 p-2 shadow-sm backdrop-blur-sm">
                    <audio
                      ref={audioRef}
                      src={audio}
                      preload="auto"
                      controls
                      className="w-full h-7"
                    />
                  </div>
                )}
              </div>

              {/* RIGHT: Caption & Interactions (55% on mobile, full width on desktop) */}
              <div className="w-[55%] md:w-full flex flex-col justify-between">
                <p className="text-xs md:text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap line-clamp-4 md:line-clamp-none">
                  {text}
                </p>

                {audio && !image && !video && (
                  <div className="mt-2 rounded-xl border border-white/40 bg-white/60 p-2 shadow-sm">
                    <audio
                      ref={audioRef}
                      src={audio}
                      preload="auto"
                      controls
                      className="w-full h-7"
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLike?.();
                    }}
                    className="py-1.5 md:py-2.5 text-xs font-bold text-pink-600 hover:bg-pink-50/40 text-center transition-colors rounded-lg border border-pink-200/50 md:border-slate-100"
                  >
                    {liked ? "❤️" : "🤍"} {likes}
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectPost?.()}
                    className="py-1.5 md:py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50/40 text-center transition-colors rounded-lg border border-blue-200/50 md:border-slate-100"
                  >
                    💬 {comments?.length || 0}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700 leading-relaxed whitespace-pre-wrap px-0.5">
                {text}
              </p>

              {audio && !video && (
                <div className="rounded-xl border border-white/40 bg-white/60 p-2 shadow-sm">
                  <audio
                    ref={audioRef}
                    src={audio}
                    preload="auto"
                    controls
                    className="w-full h-7"
                  />
                </div>
              )}

              <div className="flex bg-white/50 rounded-xl border border-slate-100 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLike?.();
                  }}
                  className="flex-1 py-2.5 text-xs font-bold text-pink-600 hover:bg-pink-50/40 text-center transition-colors"
                >
                  {liked ? "❤️" : "🤍"} {likes} Likes
                </button>
                <div className="w-px bg-slate-100"></div>
                <button
                  type="button"
                  onClick={() => onSelectPost?.()}
                  className="flex-1 py-2.5 text-xs font-bold text-blue-600 hover:bg-blue-50/40 text-center transition-colors"
                >
                  💬 {comments?.length || 0} Comments
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Inline Comments Section Extension */}
      {isSelected && (
        <div className="mt-4 pt-4 border-t border-slate-200/60 space-y-4">
          <h4 className="font-bold text-sm text-slate-800 px-0.5">Comments</h4>

          {/* Comments List Scroll Tray */}
          <div className="max-h-56 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
            {comments?.length ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-slate-50/60 rounded-2xl p-3 border border-slate-100 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p
                      onClick={() => navigate(`/profile/${comment.user.username}`)}
                      className="font-bold text-xs text-slate-800 cursor-pointer hover:text-pink-500 transition-colors"
                    >
                      {comment.user.username}
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(Number(comment.id));
                          setEditingText(comment.text || "");
                        }}
                        className="text-slate-400 hover:text-blue-500 text-xs p-0.5"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteComment?.(Number(comment.id))}
                        className="text-slate-400 hover:text-red-500 text-xs p-0.5"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {editingId === Number(comment.id) ? (
                    <div className="space-y-1.5 pt-1">
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs bg-white outline-none focus:border-pink-300"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onEditComment?.(Number(comment.id), editingText);
                          setEditingId(null);
                        }}
                        className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-3 py-1 rounded-lg text-[11px] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-600 text-xs font-medium leading-relaxed">
                      {comment.text}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-0.5">
                    <button
                      type="button"
                      onClick={() => onLikeComment?.(Number(comment.id))}
                      className="text-pink-500 font-bold text-[11px] flex items-center gap-1 hover:scale-105 transition-transform"
                    >
                      <span>❤️</span> {comment.likes}
                    </button>
                  </div>

                  {comment.voice && (
                    <div className="mt-1.5 pt-1 border-t border-slate-100">
                      <audio controls src={comment.voice} className="w-full h-6 opacity-80" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center text-xs py-4 font-medium">
                No comments yet. Drop a vibe below! 👇
              </p>
            )}
          </div>

          {/* Bottom Interactive Comment Composer Bar */}
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-pink-300 transition-colors placeholder:text-slate-400"
              />

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-8 h-8 shrink-0 rounded-xl font-bold text-xs flex items-center justify-center shadow-2xs transition-colors ${
                  isRecording ? "bg-red-500 text-white animate-pulse" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                }`}
              >
                {isRecording ? "⏹" : "🎤"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!newComment.trim() && !voiceComment) return;

                  onAddComment?.({
                    id: Date.now(),
                    text: newComment,
                    voice: voiceComment,
                  });

                  setNewComment("");
                  setVoiceComment(undefined);
                }}
                className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-3.5 rounded-xl text-xs transition-colors shadow-2xs"
              >
                Send
              </button>
            </div>

            {voiceComment && (
              <div className="pt-1.5 border-t border-slate-200/50">
                <audio controls src={voiceComment} className="w-full h-6 opacity-90" />
              </div>
            )}
          </div>

          {/* Close Section Action Block */}
          <button
            type="button"
            onClick={() => onClosePost?.()}
            className="w-full py-2 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-700 font-bold text-xs hover:bg-slate-200/80 transition-colors"
          >
            Close Comments
          </button>
        </div>
      )}

      </div>

      {viewerOpen && image && (
        <ImageViewer
          images={[image]}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
          postId={postId}
          authorId={authorId ?? author.id}
          authorUsername={author.username}
          onEditPost={onEditPost}
          onDeleteImage={onDeleteImage}
          onDeletePost={onDeletePost}
          onRepost={onRepost}
          onMuteUser={onMuteUser}
        />
      )}
    </div>
  );
}