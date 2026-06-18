type User = {
  id: string;
  username: string;
  avatar?: string;
};

type Comment = {
  id: number;
  user: User;
  text?: string;
  voice?: string;
  likes: number;
};

type Props = {
  author: User;
  postId?: string | number;
  authorId?: string;
  time: string;
  text: string;
  image?: string;

  comments?: Comment[];
  likes: number;
  liked?: boolean;
  highlighted?: boolean;

  onDeletePost?: () => void;
  onEditPost?: () => void;
  onDeleteImage?: () => void;

  isSelected?: boolean;
  onToggleLike?: () => void;
  onSelectPost?: () => void;
  onClosePost?: () => void;
  onRepost?: () => void;
  onSavePost?: () => void;
  onMuteUser?: () => void;
  onHighlight?: () => void;

  onAddComment?: (
    comment: {
      id: number;
      text?: string;
      voice?: string;
    }
  ) => void;

  onDeleteComment?: (
    commentId: number
  ) => void;

  onEditComment?: (
    commentId: number,
    newText: string
  ) => void;

  onLikeComment?: (
    commentId: number
  ) => void;
};

import {
  useState,
  useRef,
  useEffect,
} from "react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import ImageViewer from "./ImageViewer";
import { getProfile } from "../utils/profileStorage";

export default function PostCard({
  author,
  postId,
  authorId,
  time,
  text,
  image,
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
  onEditPost,
  onDeleteImage,
  onHighlight,
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
  const [newComment, setNewComment] =
    useState("");

  const [voiceComment, setVoiceComment] =
    useState<string | undefined>(undefined);

  const [editingId, setEditingId] =
    useState<number | null>(null);

  const [editingText, setEditingText] =
    useState("");

  const mediaRecorderRef =
    useRef<MediaRecorder | null>(null);

  const chunksRef =
    useRef<Blob[]>([]);

  const [isRecording, setIsRecording] =
    useState(false);

  const showImage = Boolean(image);

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

  // Close menu on navigation (only if open)
  useEffect(() => {
    // Close the menu when the route changes. Use a short timeout
    // to avoid synchronous setState within the effect body.
    const timeout = window.setTimeout(() => setShowMenu(false), 0);
    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  const startRecording = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          }
        );
      const recorder =
        new MediaRecorder(stream);

      mediaRecorderRef.current =
        recorder;

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        chunksRef.current.push(
          e.data
        );
      };

      recorder.onstop = () => {
        const blob = new Blob(
          chunksRef.current,
          {
            type: "audio/webm",
          }
        );

        const audioUrl =
          URL.createObjectURL(blob);

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
    <div className={`bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-4 mb-6 transition-transform duration-200 ${
      isSelected ? "scale-105 z-50" : ""
    }`}>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">

        <div className="flex items-center gap-3">

          {author.avatar ? (
            <img
              src={author.avatar}
              alt={author.username}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-linear-to-r from-pink-400 via-purple-400 to-blue-400"></div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h3
                onClick={() =>
                  navigate(
                    `/profile/${author.username}`
                  )
                }
                className="font-bold text-lg text-slate-800 cursor-pointer hover:text-pink-500"
              >
                {author.username}
              </h3>
              <span className="text-xs text-slate-500">{time}</span>

              {highlighted && (
                <span className="text-[10px] uppercase tracking-[0.3em] bg-yellow-100 text-yellow-700 rounded-full px-2 py-1">
                  Highlight
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <button
              ref={menuButtonRef}
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu((prev) => !prev);
              }}
              className="text-slate-400 text-xl"
            >
              ⋯
            </button>

            {showMenu && (
              <div
                ref={menuRef}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl text-sm text-slate-700 overflow-hidden z-50"
              >
                {isOwner ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onEditPost?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
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
                        className="w-full text-left px-4 py-3 hover:bg-slate-50"
                      >
                        🗑️ Delete Image
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onDeletePost?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50 text-red-600"
                    >
                      🗑️ Delete Post
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/post/${postId ?? ownerId}`);
                        alert("Link copied!");
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      🔗 Copy Link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onHighlight?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      {highlighted ? "✨ Unhighlight" : "✨ Highlight"}
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
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      📤 Share
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onRepost?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      🔁 Repost
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSavePost?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      💾 Save Post
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onHighlight?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      {highlighted ? "✨ Unhighlight" : "✨ Highlight"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        alert("Report submitted. Thanks for helping keep MeToYou safe.");
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      🚩 Report
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onMuteUser?.();
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      🔕 Mute User
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/post/${postId ?? ownerId}`);
                        alert("Link copied!");
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-slate-50"
                    >
                      🔗 Copy Link
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
      </div>
      </div>

      {/* Content */}
      {showImage ? (
        <div className="flex flex-col md:flex-row gap-4">

          <div className="w-full md:w-[45%] h-55 rounded-3xl bg-linear-to-br from-pink-200 via-purple-200 to-blue-200 flex items-center justify-center text-5xl overflow-hidden">
            {image ? (
              <img
                src={image}
                alt={`${author.username}'s post`}
                className="w-full h-full object-cover cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewerIndex(0);
                  onClosePost?.();
                  setViewerOpen(true);
                }}
              />
            ) : (
              "📸"
            )}
          </div>

          <div className="flex-1 flex flex-col justify-between">

            <p className="text-xl font-semibold text-slate-800 leading-relaxed">
              {text}
            </p>

            <div className="mt-4 flex bg-white rounded-2xl border border-slate-100 overflow-hidden">

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLike?.();
                }}
                className="flex-1 py-3 font-semibold text-pink-600 text-left"
              >
                {liked ? "❤️" : "🤍"} {likes} Likes
              </button>

              <div className="w-px bg-slate-200"></div>

              <button
                type="button"
                onClick={() =>
                  onSelectPost?.()
                }
                className="flex-1 py-3 font-semibold text-blue-600"
              >
                💬 {comments?.length || 0} Comments
              </button>

            </div>

          </div>

        </div>
      ) : (
        <div>

          <p className="text-xl font-semibold text-slate-800 leading-relaxed mb-4">
            {text}
          </p>

          <div className="flex bg-white rounded-2xl border border-slate-100 overflow-hidden">

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleLike?.();
              }}
              className="flex-1 py-3 font-semibold text-pink-600 text-left"
            >
              {liked ? "❤️" : "🤍"} {likes} Likes
            </button>

            <div className="w-px bg-slate-200"></div>

            <button
              type="button"
              onClick={() =>
                onSelectPost?.()
              }
              className="flex-1 py-3 font-semibold text-blue-600"
            >
              💬 {comments?.length || 0} Comments
            </button>

          </div>

        </div>
      )}

      {/* Inline Comments Section - Visible when selected */}
      {isSelected && (
        <div className="mt-6 pt-6 border-t border-white/40">
          <h3 className="font-bold text-lg mb-4 text-slate-800">
            Comments
          </h3>

          <div className="max-h-64 overflow-y-auto mb-4">
            {comments?.length ? (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className="mb-4 pb-4 border-b border-slate-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p
                    onClick={() =>
                      navigate(
                        `/profile/${comment.user.username}`
                      )
                    }
                    className="font-bold text-sm text-slate-800 cursor-pointer hover:text-pink-500"
                  >
                    {comment.user.username}
                  </p>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditingText(
                            comment.text || ""
                          );
                        }}
                        className="text-blue-500 text-sm"
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onDeleteComment?.(
                            comment.id
                          )
                        }
                        className="text-red-500 text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {editingId === comment.id ? (
                    <div>
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) =>
                          setEditingText(
                            e.target.value
                          )
                        }
                        className="w-full border rounded-xl px-3 py-2"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          onEditComment?.(
                            comment.id,
                            editingText
                          );
                          setEditingId(null);
                        }}
                        className="mt-2 bg-pink-500 text-white px-4 py-1 rounded-xl text-sm"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <p className="text-slate-700 text-sm">
                      {comment.text}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onLikeComment?.(
                        comment.id
                      )
                    }
                    className="mt-2 text-pink-500 font-semibold text-sm"
                  >
                    ❤️ {comment.likes}
                  </button>

                  {comment.voice && (
                    <div className="mt-2">
                      <audio
                        controls
                        src={comment.voice}
                        className="w-full h-8"
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center text-sm">
                No comments yet.
              </p>
            )}
          </div>

          {/* Comment Input */}
          <div className="bg-slate-50 rounded-2xl p-3">
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) =>
                  setNewComment(
                    e.target.value
                  )
                }
                placeholder="Write a comment..."
                className="flex-1 border rounded-xl px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                className={`px-3 py-2 rounded-xl font-semibold text-sm ${
                  isRecording
                    ? "bg-red-500 text-white"
                    : "bg-blue-500 text-white"
                }`}
              >
                {isRecording ? "⏹" : "🎤"}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (
                    !newComment.trim() &&
                    !voiceComment
                  )
                    return;

                  onAddComment?.({
                    id: Date.now(),
                    text: newComment,
                    voice: voiceComment,
                  });

                  setNewComment("");
                  setVoiceComment(undefined);
                }}
                className="bg-pink-500 text-white px-3 rounded-xl font-semibold text-sm"
              >
                Send
              </button>
            </div>

            {voiceComment && (
              <div className="mt-2">
                <audio
                  controls
                  src={voiceComment}
                  className="w-full h-8"
                />
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => onClosePost?.()}
            className="mt-4 w-full py-2 rounded-xl bg-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-300"
          >
            Close Comments
          </button>
        </div>
      )}

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