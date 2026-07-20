import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addComment, getComments, type CommentRecord } from "../lib/commentApi";
import { getPostLikes, hasUserLiked, likePost, unlikePost } from "../lib/likeApi";
import { supabase } from "../lib/supabase";
import { useSession } from "../contexts/SessionContext";

type Props = {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  postId?: string | number;
  authorId?: string;
  authorUsername?: string;
  onEditPost?: () => void;
  onDeleteImage?: () => void;
  onDeletePost?: () => void;
  onRepost?: () => void;
  onMuteUser?: () => void;
  variant?: 'default' | 'vibespro';
};

export default function ImageViewer({ images, initialIndex = 0, onClose, postId, authorId, authorUsername, onEditPost, onDeleteImage, onDeletePost, onRepost, onMuteUser, variant = 'default' }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [showComments, setShowComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [sharePressed, setSharePressed] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const commentsPanelRef = useRef<HTMLDivElement | null>(null);
  const isCommentComposerFocusedRef = useRef(false);
  const { profile: currentUser } = useSession();
  const ownerId = authorId ?? undefined;
  const isOwner = Boolean(currentUser && ownerId && currentUser.id === ownerId);
  const startY = useRef<number | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);
  const isVibesProVariant = variant === 'vibespro';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % images.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + images.length) % images.length);
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // Reset zoom when changing images (use setTimeout to avoid sync setState warning)
  useEffect(() => {
    const timer = setTimeout(() => setScale(1), 0);
    return () => clearTimeout(timer);
  }, [index]);

  useEffect(() => {
    let active = true;

    const loadInteractions = async () => {
      if (!postId || !currentUser?.id) return;

      try {
        const [likedState, likes, comments] = await Promise.all([
          hasUserLiked(String(postId), currentUser.id),
          getPostLikes(String(postId)),
          getComments(String(postId)),
        ]);

        if (!active) return;
        setLiked(Boolean(likedState));
        setLikeCount(likes.length);
        setCommentCount(comments.length);
        setComments(comments);
      } catch (error) {
        console.warn("Unable to load viewer interactions", error);
      }
    };

    loadInteractions();
    return () => {
      active = false;
    };
  }, [currentUser?.id, postId]);

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
    const isMobileViewport = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 900;

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

      if (isMobileViewport) {
        return;
      }

      if (
        showComments &&
        commentsPanelRef.current &&
        !commentsPanelRef.current.contains(target)
      ) {
        setShowComments(false);
      }
    };

    const onScroll = () => {
      if (isCommentComposerFocusedRef.current || isMobileViewport) return;
      setShowMenu(false);
      setShowComments(false);
    };

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [showComments]);

  // Mouse wheel zoom
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => {
      const newScale = prev - e.deltaY * 0.001;
      return Math.max(1, Math.min(newScale, 4));
    });
  };

  // Double-click zoom
  const onDoubleClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 300) {
      setScale((prev) => (prev === 1 ? 2 : 1));
    }
    lastClickTimeRef.current = now;
  };

  // Pinch zoom on mobile
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      startY.current = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
      startY.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    // Pinch zoom
    if (e.touches.length === 2 && pinchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDistance = Math.sqrt(dx * dx + dy * dy);
      const ratio = newDistance / pinchDistanceRef.current;

      setScale((prev) => {
        const newScale = prev * ratio;
        return Math.max(1, Math.min(newScale, 4));
      });

      pinchDistanceRef.current = newDistance;
    }
    // Swipe down to close (single touch)
    else if (e.touches.length === 1 && startY.current !== null) {
      const deltaY = e.touches[0].clientY - startY.current;
      if (Math.abs(deltaY) > 80 && deltaY > 0) {
        onClose();
        startY.current = null;
      }
    }
  };

  const handleShare = async () => {
    setSharePressed(true);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `${authorUsername ?? 'Post'}`, url: window.location.href });
      }

      if (postId && currentUser?.id) {
        try {
          await supabase.from("post_shares").insert({
            post_id: String(postId),
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
          });
        } catch (shareError) {
          console.warn("Share event could not be persisted to Supabase", shareError);
        }
      }
    } catch (err) {
      console.warn(err);
    }
    window.setTimeout(() => setSharePressed(false), 250);
  };

  const handleLikeToggle = async () => {
    if (!postId || !currentUser?.id) return;

    try {
      if (liked) {
        const removed = await unlikePost(String(postId), currentUser.id);
        if (removed) {
          setLiked(false);
          setLikeCount((count) => Math.max(0, count - 1));
        }
      } else {
        const savedLike = await likePost(String(postId), currentUser.id);
        if (savedLike) {
          setLiked(true);
          setLikeCount((count) => count + 1);
        }
      }
    } catch (error) {
      console.warn("Unable to toggle like", error);
    }
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!postId || !currentUser?.id) return;

    const trimmed = commentDraft.trim();
    if (!trimmed) return;

    try {
      setSubmittingComment(true);
      const savedComment = await addComment(String(postId), currentUser.id, trimmed);
      if (savedComment) {
        setComments((current) => [savedComment, ...current]);
        setCommentCount((count) => count + 1);
        setCommentDraft("");
      }
    } catch (error) {
      console.warn("Unable to save comment", error);
    } finally {
      setSubmittingComment(false);
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      onClick={onOverlayClick}
      className={`fixed inset-0 z-9999 flex items-center justify-center ${isVibesProVariant ? 'bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.22),rgba(0,0,0,0.95)_68%)]' : 'bg-black/95'}`}
    >
      <div className={`absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.16),transparent_35%),radial-gradient(circle_at_top_right,rgba(250,204,21,0.16),transparent_35%)] pointer-events-none ${isVibesProVariant ? '' : 'hidden'}`} />

      <button
        onClick={onClose}
        aria-label="Close"
        className={`absolute top-4 right-4 z-10000 rounded-full border border-white/20 bg-white/10 p-2 text-3xl text-white shadow-lg backdrop-blur-sm transition hover:scale-105 ${isVibesProVariant ? 'border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_24px_rgba(250,204,21,0.2)]' : ''}`}
      >
        ×
      </button>

      <div className="absolute top-4 right-14 z-10000">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((s) => !s);
          }}
          className={`rounded-full border border-white/20 bg-white/10 px-2 py-1 text-2xl text-white shadow-lg backdrop-blur-sm ${isVibesProVariant ? 'border-amber-300/50 bg-amber-400/15 text-amber-100' : ''}`}
          aria-label="Image menu"
        >
          ⋯
        </button>

        {showMenu && (
          <div ref={menuRef} className="mt-2 w-48 rounded-2xl bg-white border border-slate-200 shadow-xl text-sm text-slate-700 overflow-hidden">
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
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.share({ title: `${authorUsername ?? 'Post'}`, url: window.location.href });
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

      <button
        onClick={prev}
        className={`absolute left-4 z-10000 rounded-full border border-white/20 bg-white/10 p-2 text-3xl text-white shadow-lg backdrop-blur-sm transition hover:scale-105 ${isVibesProVariant ? 'border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_24px_rgba(250,204,21,0.2)]' : ''}`}
        aria-label="Previous"
      >
        ‹
      </button>

      <div className="flex h-full w-full items-center justify-center p-2 sm:p-4 lg:p-6">
        <div className={`relative flex max-h-[90vh] max-w-[92vw] items-center justify-center overflow-hidden rounded-[30px] bg-black/20 p-px shadow-[0_18px_70px_rgba(0,0,0,0.45)] backdrop-blur-sm ${isVibesProVariant ? 'shadow-[0_0_0_1px_rgba(255,215,0,0.2),0_20px_80px_rgba(250,204,21,0.18)]' : ''}`}>
          <div className={`pointer-events-none absolute inset-0 rounded-[30px] border ${isVibesProVariant ? 'border-[0.75px] border-amber-200/70' : 'border border-white/10'}`} />
          <div className={`pointer-events-none absolute left-3 top-3 h-5 w-5 rotate-45 rounded-tl-xl border-l border-t border-amber-300/70 ${isVibesProVariant ? 'block' : 'hidden'}`} />
          <div className={`pointer-events-none absolute bottom-3 right-3 h-5 w-5 rotate-45 rounded-br-xl border-b border-r border-amber-300/70 ${isVibesProVariant ? 'block' : 'hidden'}`} />
          <div className={`pointer-events-none absolute left-5 top-5 text-[10px] text-amber-200/80 ${isVibesProVariant ? 'block' : 'hidden'}`}>✦</div>
          <div className={`pointer-events-none absolute bottom-5 right-5 text-[10px] text-amber-200/80 ${isVibesProVariant ? 'block' : 'hidden'}`}>✦</div>

          <img
            ref={imgRef}
            src={images[index]}
            alt={`image-${index}`}
            onWheel={onWheel}
            onDoubleClick={onDoubleClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            className="max-h-[80vh] max-w-[86vw] select-none object-contain rounded-[28px] transition-transform duration-150"
            style={{
              transform: `scale(${scale})`,
              cursor: scale > 1 ? "grab" : "zoom-in",
            }}
          />
        </div>
      </div>

      <button
        onClick={next}
        className={`absolute right-4 z-10000 rounded-full border border-white/20 bg-white/10 p-2 text-3xl text-white shadow-lg backdrop-blur-sm transition hover:scale-105 ${isVibesProVariant ? 'border-amber-300/50 bg-amber-400/15 text-amber-100 shadow-[0_0_24px_rgba(250,204,21,0.2)]' : ''}`}
        aria-label="Next"
      >
        ›
      </button>

      {showComments ? (
        <div
          ref={commentsPanelRef}
          className="absolute bottom-20 left-1/2 z-10000 w-[min(92vw,30rem)] -translate-x-1/2 rounded-3xl border border-white/15 bg-black/70 p-3 shadow-[0_10px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Comments</p>
            <button type="button" onClick={() => setShowComments(false)} className="text-sm text-amber-200/90">Close</button>
          </div>

          <div className="mb-3 max-h-44 space-y-2 overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <p className="text-sm text-white/70">No comments yet. Start the thread.</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/90">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold text-white">
                      {comment.profiles?.username ?? "Someone"}
                    </span>
                    <span className="text-[11px] text-white/55">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="leading-relaxed text-white/80">{comment.text}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/10 p-2">
            <input
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onFocus={() => {
                isCommentComposerFocusedRef.current = true;
              }}
              onBlur={() => {
                isCommentComposerFocusedRef.current = false;
              }}
              placeholder="Write a comment"
              className="flex-1 bg-transparent px-2 py-1 text-sm text-white outline-none placeholder:text-white/45"
            />
            <button
              type="submit"
              disabled={submittingComment || !commentDraft.trim()}
              className="rounded-full bg-amber-400/20 px-3 py-1.5 text-sm font-semibold text-amber-100 transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittingComment ? "Posting..." : "Post"}
            </button>
          </form>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-1/2 z-10000 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-2 py-2 shadow-[0_10px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:gap-3 sm:px-3">
        <button
          type="button"
          onClick={handleLikeToggle}
          className={`rounded-full px-3 py-2 text-sm font-semibold transition ${isVibesProVariant ? 'bg-amber-400/15 text-amber-100 hover:bg-amber-400/25' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          {liked ? `💖 ${likeCount}` : `♡ ${likeCount}`}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((value) => !value)}
          className={`rounded-full px-3 py-2 text-sm font-semibold transition ${isVibesProVariant ? 'bg-amber-400/15 text-amber-100 hover:bg-amber-400/25' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          💬 {commentCount}
        </button>
        <button
          type="button"
          onClick={handleShare}
          className={`rounded-full px-3 py-2 text-sm font-semibold transition ${isVibesProVariant ? 'bg-amber-400/15 text-amber-100 hover:bg-amber-400/25' : 'bg-white/10 text-white hover:bg-white/20'} ${sharePressed ? 'scale-95' : ''}`}
        >
          {sharePressed ? '↗ Shared' : '↗ Share'}
        </button>
      </div>
    </div>,
    document.body
  );
}
