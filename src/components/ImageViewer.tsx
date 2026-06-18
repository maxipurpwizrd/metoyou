import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getProfile } from "../utils/profileStorage";

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
};

export default function ImageViewer({ images, initialIndex = 0, onClose, postId, authorId, authorUsername, onEditPost, onDeleteImage, onDeletePost, onRepost, onMuteUser }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const currentUser = getProfile();
  const ownerId = authorId ?? undefined;
  const isOwner = Boolean(currentUser && ownerId && currentUser.id === ownerId);
  const startY = useRef<number | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const lastClickTimeRef = useRef<number>(0);

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

  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);
  const next = () => setIndex((i) => (i + 1) % images.length);

  const onOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  useEffect(() => {
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

    const onScroll = () => setShowMenu(false);

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

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

  return createPortal(
    <div
      ref={overlayRef}
      onClick={onOverlayClick}
      className="fixed inset-0 z-9999 bg-black/95 flex items-center justify-center"
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 text-white text-4xl z-10000"
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
          className="text-white text-2xl px-2"
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
        className="absolute left-4 z-10000 text-white text-3xl p-2"
        aria-label="Previous"
      >
        ‹
      </button>

      <div className="w-full h-full flex items-center justify-center p-4">
        <img
          ref={imgRef}
          src={images[index]}
          alt={`image-${index}`}
          onWheel={onWheel}
          onDoubleClick={onDoubleClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          className="max-h-screen max-w-screen object-contain cursor-zoom-in select-none transition-transform duration-150"
          style={{
            transform: `scale(${scale})`,
            cursor: scale > 1 ? "grab" : "zoom-in",
          }}
        />
      </div>

      <button
        onClick={next}
        className="absolute right-4 z-10000 text-white text-3xl p-2"
        aria-label="Next"
      >
        ›
      </button>
    </div>,
    document.body
  );
}
