import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef, type ChangeEvent } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLanguage } from "../contexts/LanguageContext";
import { useAppInit } from "../contexts/AppInitContext";
import { getMessageThreads, type MessageThread } from "../lib/messageApi";
import { useSession } from "../contexts/SessionContext";
import { MessagesSkeleton } from "../components/skeletons/Skeletons";
import { VibesProFeed } from "../themes/vibespro";
import { isVibesProEnabled } from "../lib/vibesPro";
import { createStoryToSupabase, deleteStoryFromSupabase, fetchStoriesFromSupabase, type StoryRecord, type StoryType } from "../lib/storyApi";
import { savePostToSupabase } from "../lib/postApi";

export default function Messages(_props: { embedded?: boolean } = {}) {
  // Prevent rendering until app initialization completes
  const { appReady } = useAppInit();
  const { profileReady } = useSession();
  if (!appReady || !profileReady) return null;
  const { user } = useAuth();
  const currentUserId = (user as any)?.id as string | undefined;
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState<StoryRecord | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyChoiceOpen, setStoryChoiceOpen] = useState(false);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [storyMode, setStoryMode] = useState<"text" | "photo" | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState<string>("");
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyCreateError, setStoryCreateError] = useState<string | null>(null);
  const [storyCreateProgress, setStoryCreateProgress] = useState(0);
  const [storyCreateStatus, setStoryCreateStatus] = useState<string | null>(null);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const storyMenuRef = useRef<HTMLDivElement | null>(null);
  const [savedStories, setSavedStories] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("metoyou-saved-stories");
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [archivedThreadIds, setArchivedThreadIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [blockedThreadIds, setBlockedThreadIds] = useState<Set<string>>(new Set());
  const [contextMenuThreadId, setContextMenuThreadId] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const { profile } = useSession();
  const isVibesPro = isVibesProEnabled(profile);

  // Restore/save scroll position for messages list per user
  useEffect(() => {
    const userId = (user as any)?.id;
    if (!userId) return;
    const scrollKey = `metoyou-messages-scroll:${userId}`;
    const saved = Number(sessionStorage.getItem(scrollKey) || "0");
    if (saved && typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo(0, saved));
    }

    return () => {
      try {
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      } catch (e) {
        // ignore
      }
    };
  }, [user]);

  // Cache-first load of message threads + silent background refresh
  useEffect(() => {
    mountedRef.current = true;
    const userId = (user as any)?.id as string | undefined;
    if (!userId) return;

    const cacheKey = `metoyou-threads:${userId}`;
    const lastKey = `${cacheKey}:lastFetch`;

    // Try cache first
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as MessageThread[];
        const sorted = [...cached].sort((a, b) => {
          const aTime = a.lastTime ? new Date(a.lastTime).getTime() : 0;
          const bTime = b.lastTime ? new Date(b.lastTime).getTime() : 0;
          return bTime - aTime;
        });
        setThreads(sorted);
      }
    } catch (e) {
      // ignore parse errors
    }

    // If no cached data, show loading until first remote arrives
    const hasCache = Boolean(sessionStorage.getItem(cacheKey));
    if (!hasCache) setIsLoading(true);

    void (async () => {
      try {
        const last = Number(sessionStorage.getItem(lastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return; // throttle background refresh

        const remote = await getMessageThreads(userId);
        if (!mountedRef.current || !remote) return;

        setThreads((prevThreads) => {
          const byId = new Map<string, MessageThread>();
          prevThreads.forEach((t) => byId.set(t.otherId, t));

          let changed = false;
          remote.forEach((r) => {
            const existing = byId.get(r.otherId);
            if (!existing) {
              byId.set(r.otherId, r);
              changed = true;
              return;
            }

            const existingTime = existing.lastTime ? new Date(existing.lastTime).getTime() : 0;
            const remoteTime = r.lastTime ? new Date(r.lastTime).getTime() : 0;
            if (remoteTime !== existingTime || r.lastText !== existing.lastText) {
              byId.set(r.otherId, r);
              changed = true;
            }
          });

          if (!changed && hasCache) {
            return prevThreads;
          }

          const merged = Array.from(byId.values()).sort((a, b) => {
            const aTime = a.lastTime ? new Date(a.lastTime).getTime() : 0;
            const bTime = b.lastTime ? new Date(b.lastTime).getTime() : 0;
            return bTime - aTime;
          });

          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(merged));
            sessionStorage.setItem(lastKey, String(Date.now()));
          } catch (e) {
            // ignore storage errors
          }

          return merged;
        });
      } catch (err) {
        console.warn("Failed to refresh message threads", err);
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      mountedRef.current = false;
    };
  }, [user]);

  useEffect(() => {
    if (!currentUserId) return;

    try {
      const saved = sessionStorage.getItem(`metoyou-archived-threads:${currentUserId}`);
      if (saved) {
        const ids = JSON.parse(saved) as string[];
        setArchivedThreadIds(new Set(ids));
      }
    } catch (error) {
      console.warn("Failed to restore archived threads", error);
    }
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    try {
      sessionStorage.setItem(
        `metoyou-archived-threads:${currentUserId}`,
        JSON.stringify(Array.from(archivedThreadIds))
      );
    } catch (error) {
      console.warn("Failed to persist archived threads", error);
    }
  }, [archivedThreadIds, currentUserId]);

  const visibleThreads = threads.filter((thread) => !blockedThreadIds.has(thread.otherId) && !archivedThreadIds.has(thread.otherId));

  const closeContextMenu = () => {
    setIsMenuOpen(false);
    setContextMenuThreadId(null);
    setContextMenuPosition(null);
  };

  const openContextMenu = (threadId: string, x: number, y: number) => {
    setContextMenuThreadId(threadId);
    setContextMenuPosition({ x, y });
    setIsMenuOpen(true);
  };

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleArchiveThread = (threadId: string) => {
    setArchivedThreadIds((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      return next;
    });
    closeContextMenu();
    navigate("/messages/archived");
  };

  const handleBlockThread = (threadId: string) => {
    setBlockedThreadIds((prev) => new Set(prev).add(threadId));
    closeContextMenu();
  };

  const handleReportThread = (threadId: string) => {
    closeContextMenu();
    window.alert(t("messages.reportConfirmation") || "This conversation has been reported. Our moderation team will review it shortly.");
  };

  const handleStoryClick = () => {
    setStoryChoiceOpen(true);
  };

  const openStoryEditor = (mode: "text" | "photo") => {
    setStoryMode(mode);
    setStoryChoiceOpen(false);

    if (mode === "photo") {
      fileInputRef.current?.click();
      return;
    }

    setStoryEditorOpen(true);
    setSelectedImage(null);
    setStoryText("");
    setStoryCreateError(null);
    setStoryCreateProgress(0);
    setStoryCreateStatus(null);
  };

  const handleStoryImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setStoryEditorOpen(true);
      setStoryText("");
      setStoryCreateError(null);
      setStoryCreateProgress(0);
      setStoryCreateStatus(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async () => {
    if (!selectedImage && !storyText.trim()) return;
    if (!profile || !currentUserId) return;

    const displayName = profile.username || "MeToYou";
    const storyType: StoryType = selectedImage ? "photo" : "text";

    setStoryCreateError(null);
    setStoryCreating(true);
    setStoryCreateProgress(0);
    setStoryCreateStatus(selectedImage ? "Uploading" : "Posting");

    const progressInterval = window.setInterval(() => {
      setStoryCreateProgress((current) => Math.min(current + 12, 95));
    }, 250);

    try {
      const createdStory = await createStoryToSupabase({
        authorId: currentUserId,
        username: displayName,
        profilePic: profile.profilePic ?? null,
        text: storyText.trim() || undefined,
        image: selectedImage ?? undefined,
        storyType,
        durationHours: 24,
      });

      if (!createdStory) {
        setStoryCreateError("Could not create story right now.");
      } else {
        setStories((prev) => [createdStory, ...prev.filter((story) => story.id !== createdStory.id)]);
        setStoryEditorOpen(false);
        setStoryMode(null);
        setSelectedImage(null);
        setStoryText("");
      }
    } catch (error) {
      console.error("Failed to create story", error);
      setStoryCreateError("Could not create story right now.");
    } finally {
      window.clearInterval(progressInterval);
      setStoryCreating(false);
      setStoryCreateProgress(100);
      setStoryCreateStatus(null);
      setTimeout(() => setStoryCreateProgress(0), 400);
    }
  };

  const handleCloseStoryEditor = () => {
    setStoryEditorOpen(false);
    setStoryMode(null);
    setSelectedImage(null);
    setStoryText("");
    setStoryCreateError(null);
    setStoryCreateProgress(0);
    setStoryCreateStatus(null);
  };

  const openStoryAtIndex = (index: number) => {
    const story = stories[index];
    if (!story) return;

    setSelectedStory(story);
    setSelectedStoryIndex(index);
    setStoryProgress(0);
  };

  const closeStoryViewer = () => {
    setSelectedStory(null);
    setSelectedStoryIndex(null);
    setStoryProgress(0);
    setStoryMenuOpen(false);
  };

  const toggleStoryMenu = () => {
    setStoryMenuOpen((open) => !open);
  };

  const handleShareStory = async () => {
    if (!selectedStory) return;
    setStoryMenuOpen(false);

    const shareText = selectedStory.text
      ? `${selectedStory.author_username} says: ${selectedStory.text}`
      : `${selectedStory.author_username} shared a story on MeToYou.`;
    const shareUrl = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${selectedStory.author_username}'s story`,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        window.alert("Story link copied to clipboard.");
      }
    } catch (error) {
      console.error("Unable to share story", error);
    }
  };

  const handleSaveStory = () => {
    if (!selectedStory) return;
    setSavedStories((prev) => {
      if (prev.includes(selectedStory.id)) return prev;
      const next = [...prev, selectedStory.id];
      try {
        window.localStorage.setItem("metoyou-saved-stories", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
    setStoryMenuOpen(false);
  };

  const handleShareStoryToFeed = async () => {
    if (!selectedStory || !currentUserId) return;
    setStoryMenuOpen(false);

    const postText = selectedStory.text
      ? `${selectedStory.author_username}: ${selectedStory.text}`
      : `${selectedStory.author_username} shared a story.`;

    try {
      await savePostToSupabase({
        author_id: currentUserId,
        text: postText,
        image_url: selectedStory.image_url ?? null,
      });
      window.alert("Story shared to feed.");
    } catch (error) {
      console.error("Unable to share story to feed", error);
      window.alert("Unable to share story to feed.");
    }
  };

  const handleDeleteStory = async () => {
    if (!selectedStory || selectedStory.author_id !== currentUserId) return;
    setStoryMenuOpen(false);

    try {
      await deleteStoryFromSupabase(selectedStory.id);
      setStories((prev) => prev.filter((story) => story.id !== selectedStory.id));
      closeStoryViewer();
      window.alert("Your story has been deleted.");
    } catch (error) {
      console.error("Unable to delete story", error);
      window.alert("Unable to delete story.");
    }
  };

  const handleReportStory = () => {
    setStoryMenuOpen(false);
    window.alert("This story has been reported. Our moderation team will review it shortly.");
  };

  const handleStoryMenuAction = (action: string) => {
    switch (action) {
      case "delete":
        handleDeleteStory();
        break;
      case "share":
        void handleShareStory();
        break;
      case "shareToFeeds":
        void handleShareStoryToFeed();
        break;
      case "save":
        handleSaveStory();
        break;
      case "report":
        handleReportStory();
        break;
      default:
        setStoryMenuOpen(false);
    }
  };

  useEffect(() => {
    if (!storyMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!storyMenuRef.current?.contains(event.target as Node)) {
        setStoryMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [storyMenuOpen]);

  const goToNextStory = () => {
    if (selectedStoryIndex === null || stories.length === 0) return;
    const nextIndex = (selectedStoryIndex + 1) % stories.length;
    openStoryAtIndex(nextIndex);
  };

  const goToPreviousStory = () => {
    if (selectedStoryIndex === null || stories.length === 0) return;
    const previousIndex = (selectedStoryIndex - 1 + stories.length) % stories.length;
    openStoryAtIndex(previousIndex);
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = () => closeContextMenu();
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isVibesPro) return;

    let mounted = true;
    setStoriesLoading(true);

    void (async () => {
      try {
        const fetchedStories = await fetchStoriesFromSupabase();
        if (!mounted) return;
        setStories(fetchedStories);
      } catch (error) {
        console.error("Failed to load VibesPro stories on Messages page", error);
      } finally {
        if (mounted) setStoriesLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isVibesPro]);

  const messagesContent = (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-pink-100 via-purple-100 to-blue-100'} p-6 pb-32`}>
      {!isVibesPro && (
        <div className="max-w-xl mx-auto">
          {/* Header for free tier */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Link
                to="/feed"
                className="text-slate-900 bg-white/80 shadow-sm rounded-full p-2 hover:bg-white transition"
                aria-label={t("notifications.goBack")}
              >
                ←
              </Link>
              <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 shadow-[0_0_30px_rgba(255,255,255,0.35)]">
                MeToYou 💎✨
              </h1>
            </div>

            <p className="text-slate-900 text-base sm:text-lg mt-3 leading-7">
              {t("messages.subtitle")}
            </p>

            <div className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-700 justify-center">
              <span className="inline-block px-3 py-1 rounded-full bg-linear-to-r from-fuchsia-500 via-cyan-300 to-amber-300 text-white shadow-lg shadow-fuchsia-200/40">
                {t("messages.badge")}
              </span>
              <span className="inline-block px-3 py-1 rounded-full bg-white/90 text-slate-900 border border-slate-200 backdrop-blur-sm shadow-sm">
                {t("messages.badgeAlt")}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-xl mx-auto ${isVibesPro ? 'pt-8' : ''}`}>
        {isVibesPro && (
          <>
            <div className="fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-[#070707]/95 backdrop-blur-xl px-4 py-4 sm:px-6">
              <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {storiesLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="shrink-0 w-24 h-24 rounded-3xl border border-[#D4AF37]/20 bg-[#111111]/60"
                      />
                    ))
                  ) : stories.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={handleStoryClick}
                        className="shrink-0 w-24 h-24 rounded-3xl border border-[#D4AF37]/30 bg-[#111111] text-white flex items-center justify-center"
                      >
                        <Plus className="h-6 w-6" />
                      </button>
                      {stories.map((story, index) => (
                        <button
                          key={story.id}
                          type="button"
                          onClick={() => openStoryAtIndex(index)}
                          className="shrink-0 w-24 h-24 rounded-3xl overflow-hidden border border-[#D4AF37]/20 bg-[#111111]"
                        >
                          {story.image_url ? (
                            <img src={story.image_url} alt={story.author_username} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-[#1a1a1a] flex items-center justify-center text-xs text-white/70 p-2 text-center">
                              {story.author_username}
                            </div>
                          )}
                        </button>
                      ))}
                    </>
                  ) : (
                    Array.from({ length: 5 }).map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={index === 2 ? handleStoryClick : undefined}
                        className={`shrink-0 w-24 h-24 rounded-3xl border border-[#D4AF37]/20 bg-[#111111]/60 ${index === 2 ? 'text-white flex items-center justify-center' : ''}`}
                      >
                        {index === 2 ? <Plus className="h-6 w-6" /> : null}
                      </button>
                    ))
                  )}
                </div>
                <div className={`rounded-4xl p-3 shadow-2xl ${
                  isVibesPro
                    ? 'bg-[#181818] border border-[#D4AF37]/30'
                    : 'bg-white/20 backdrop-blur-3xl border border-white/30'
                }`}>
                  <input
                    type="text"
                    placeholder={t("messages.searchPlaceholder")}
                    className={`w-full outline-none bg-transparent ${
                      isVibesPro ? 'text-white placeholder-white/50' : 'text-slate-900 placeholder-slate-700'
                    }`}
                    disabled
                  />
                </div>
              </div>
            </div>
            <div className="h-32" />
          </>
        )}

        {/* Message List */}
        <div className="space-y-4">
          {isLoading ? (
          <MessagesSkeleton isVibesPro={isVibesPro} />
        ) : threads.length === 0 ? (
            <div className={`rounded-[28px] p-6 text-center shadow-sm ${
              isVibesPro
                ? 'bg-[#181818] border border-[#D4AF37]/20 text-white/70'
                : 'bg-white/30 backdrop-blur-3xl border border-white/40 text-slate-700'
            }`}>
              {t("messages.empty")}
            </div>
          ) : (
            visibleThreads.map((thread) => (
              <div
                key={thread.conversationId}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (isMenuOpen && contextMenuThreadId === thread.otherId) return;
                  navigate(`/chat?recipient=${thread.otherId}&username=${encodeURIComponent(thread.otherUsername)}`);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openContextMenu(thread.otherId, event.clientX, event.clientY);
                }}
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse") return;
                  clearPressTimer();
                  pressTimerRef.current = window.setTimeout(() => {
                    openContextMenu(thread.otherId, event.clientX, event.clientY);
                  }, 650);
                }}
                onPointerUp={clearPressTimer}
                onPointerLeave={clearPressTimer}
                className={`block rounded-4xl transition-all duration-200 ${
                  isVibesPro
                    ? 'hover:bg-[#1a1a1a] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40 bg-[#181818]'
                    : 'hover:bg-white/30'
                }`}
              >
                <div className={`p-4 ${
                  isVibesPro
                    ? 'text-white'
                    : 'text-slate-900'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                      isVibesPro
                        ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]'
                        : 'bg-linear-to-r from-pink-400 via-purple-400 to-blue-400'
                    }`}>
                      {thread.otherUsername[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold truncate ${
                        isVibesPro ? 'text-white' : 'text-slate-900'
                      }`}>
                        {thread.otherUsername}
                      </p>
                      <p className={`text-sm truncate ${
                        isVibesPro ? 'text-white/60' : 'text-slate-600'
                      }`}>
                        {thread.lastText || t("messages.noMessages")}
                      </p>
                    </div>
                    {thread.lastTime && (
                      <p className={`text-xs whitespace-nowrap ${
                        isVibesPro ? 'text-white/40' : 'text-slate-500'
                      }`}>
                        {new Date(thread.lastTime).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 px-6 pb-4 backdrop-blur-xl sm:px-0">
        <div className="mx-auto max-w-xl rounded-t-4xl overflow-hidden border border-white/10 bg-[#070707]/95 shadow-2xl">
          <div className={`flex text-center text-sm font-semibold uppercase tracking-[0.15em] text-white/80 ${
            isVibesPro ? '' : 'bg-white/10'
          }`}>
            <Link
              to="/messages/spam"
              className="flex-1 px-4 py-4 border-r border-white/10 hover:bg-white/5 transition-colors text-left"
            >
              Spam
            </Link>
            <button
              type="button"
              onClick={() => navigate("/messages/archived")}
              className="flex-1 px-4 py-4 hover:bg-white/5 transition-colors"
            >
              Archived
            </button>
          </div>
        </div>
      </div>
      {isMenuOpen && contextMenuThreadId && contextMenuPosition ? (
        <div
          className="fixed z-30 rounded-3xl border border-white/10 bg-[#080808]/95 p-3 shadow-2xl"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y, minWidth: 180 }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => handleArchiveThread(contextMenuThreadId)}
            className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/5"
          >
            Archive
          </button>
          <button
            type="button"
            onClick={() => handleBlockThread(contextMenuThreadId)}
            className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/5"
          >
            Block
          </button>
          <button
            type="button"
            onClick={() => handleReportThread(contextMenuThreadId)}
            className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/5"
          >
            Report
          </button>
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleStoryImage}
        className="hidden"
      />

      {storyChoiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setStoryChoiceOpen(false)} />
          <div className="relative w-full max-w-xs rounded-3xl bg-[#111111] border border-white/10 p-5 text-white shadow-2xl">
            <h2 className="text-lg font-bold">Create Story</h2>
            <p className="mt-2 text-sm text-white/70">Choose the content type for your story.</p>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => openStoryEditor("text")}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => openStoryEditor("photo")}
                className="rounded-2xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20"
              >
                Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {storyEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={handleCloseStoryEditor} />
          <div className="relative w-full max-w-md rounded-3xl bg-[#111111] border border-white/10 p-5 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">Share Story</h2>
                <p className="mt-1 text-sm text-white/70">Add a photo or text story for your friends.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseStoryEditor}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {selectedImage ? (
                <img src={selectedImage} alt="Story preview" className="w-full rounded-3xl object-cover" />
              ) : (
                <textarea
                  value={storyText}
                  onChange={(event) => setStoryText(event.target.value)}
                  rows={5}
                  placeholder="Write your story..."
                  className="w-full rounded-3xl border border-white/10 bg-black/60 p-4 text-sm text-white outline-none placeholder:text-white/40"
                />
              )}
              {storyCreateError ? (
                <p className="text-sm text-red-400">{storyCreateError}</p>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCreateStory}
                  disabled={storyCreating}
                  className="min-w-30 rounded-2xl bg-linear-to-r from-fuchsia-500 via-cyan-500 to-amber-400 px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {storyCreating ? "Posting..." : "Share Story"}
                </button>
                {selectedImage ? null : (
                  <button
                    type="button"
                    onClick={() => openStoryEditor("photo")}
                    className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Add Photo Instead
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStory && selectedStoryIndex !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <div className="absolute left-4 top-4 z-50">
            <button
              type="button"
              onClick={toggleStoryMenu}
              className="rounded-full border border-white/10 bg-black/50 p-2 text-white hover:bg-white/10"
              aria-label="Story options"
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>

            {storyMenuOpen && selectedStory ? (
              <div
                ref={storyMenuRef}
                className="mt-2 w-48 rounded-3xl border border-white/10 bg-[#111111]/95 p-2 shadow-2xl"
              >
                <button
                  type="button"
                  onClick={() => handleStoryMenuAction("delete")}
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => handleStoryMenuAction("share")}
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  Share
                </button>
                <button
                  type="button"
                  onClick={() => handleStoryMenuAction("shareToFeeds")}
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  Share to Feed
                </button>
                <button
                  type="button"
                  onClick={() => handleStoryMenuAction("save")}
                  className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                >
                  {savedStories.includes(selectedStory.id) ? "Saved" : "Save"}
                </button>
                {selectedStory.author_id !== currentUserId ? (
                  <button
                    type="button"
                    onClick={() => handleStoryMenuAction("report")}
                    className="w-full rounded-2xl px-3 py-2 text-left text-sm text-white hover:bg-white/10"
                  >
                    Report
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={closeStoryViewer}
            className="absolute top-4 right-4 z-50 rounded-full border border-white/20 bg-black/50 p-3 text-white hover:bg-white/10"
            aria-label="Close story"
          >
            ✕
          </button>

          <div className="relative w-full max-w-4xl h-full rounded-3xl overflow-hidden bg-slate-900 shadow-2xl">
            <div className="absolute inset-x-0 top-0 z-40 flex gap-1.5 p-2">
              {stories.map((_, index) => (
                <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{ width: `${index < selectedStoryIndex ? 100 : index === selectedStoryIndex ? storyProgress : 0}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-0 z-30 flex">
              <button type="button" onClick={goToPreviousStory} className="h-full w-1/2" aria-label="Previous story" />
              <button type="button" onClick={goToNextStory} className="h-full w-1/2" aria-label="Next story" />
            </div>

            {selectedStory.image_url ? (
              <img src={selectedStory.image_url} alt={selectedStory.author_username} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 p-6 text-white text-center">
                <p className="max-w-2xl text-2xl font-semibold leading-relaxed whitespace-pre-wrap">
                  {selectedStory.text || `${selectedStory.author_username} shared a story.`}
                </p>
              </div>
            )}

            <div className="absolute bottom-5 left-0 right-0 z-40 px-6 text-center text-sm text-white/90">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md">
                <span className="font-semibold">{selectedStory.author_username}</span>
                <span className="text-xs text-white/70">{selectedStory.story_type.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (isVibesPro) {
    return (
      <VibesProFeed hideNavbar>
        {messagesContent}
      </VibesProFeed>
    );
  }

  return messagesContent;
}