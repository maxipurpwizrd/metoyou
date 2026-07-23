import Navbar from "../components/Navbar";
import { useMemo, useState, useEffect, useRef } from "react";
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, WindowScroller } from "react-virtualized";
import { useFeed, type Post as FeedPost } from "../contexts/FeedContext";
import { useSession } from "../contexts/SessionContext";
import { VibesProFeed } from "../themes/vibespro";
import { useAppInit } from "../contexts/AppInitContext";
import { isVibesProEnabled } from "../lib/vibesPro";
import { supabase } from "../lib/supabase";

import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";
import { FreeFeedSkeleton, VibesProFeedSkeleton } from "../components/skeletons/FeedSkeletons";
import { savePostToSupabase, deletePostFromSupabase, uploadAudioToSupabase, uploadImageToSupabase } from "../lib/postApi";
import { addComment, editComment, deleteComment } from "../lib/commentApi";
import { likePost, unlikePost, getPostLikes } from "../lib/likeApi";
import {
  createStoryToSupabase,
  deleteStoryFromSupabase,
  fetchStoriesFromSupabase,
  subscribeToStories,
  type StoryRecord,
  type StoryType,
} from "../lib/storyApi";

type Post = FeedPost ;

type Story = {
  id: string;
  name: string;
  text?: string;
  image?: string;
  music?: string;
  voice?: string;
  duration: string;
  expiresAt: number;
  reactions?: { [emoji: string]: string[] };
  viewedAt?: number;
  profilePic?: string;
  storyType: StoryType;
  authorId?: string;
  createdAt?: string;
};

const mapStoryRecord = (story: StoryRecord): Story => ({
  id: story.id,
  name: story.author_username,
  text: story.text ?? undefined,
  image: story.image_url ?? undefined,
  music: undefined,
  voice: story.voice_url ?? undefined,
  duration: `${story.duration_hours}h`,
  expiresAt: new Date(story.expires_at).getTime(),
  reactions: story.reactions as { [emoji: string]: string[] } | undefined,
  profilePic: story.author_profile_pic ?? undefined,
  storyType: story.story_type,
  authorId: story.author_id,
  createdAt: story.created_at,
});

export default function Feed(_props: { embedded?: boolean } = {}) {
  const { appReady } = useAppInit();
  const { profileReady } = useSession();
  if (!appReady || !profileReady) return null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyCreateProgress, setStoryCreateProgress] = useState(0);
  const [storyCreateStatus, setStoryCreateStatus] = useState<string | null>(null);
  const [storyCreateError, setStoryCreateError] = useState<string | null>(null);
  const [storyNotice, setStoryNotice] = useState<string | null>(null);
  const [savedStories, setSavedStories] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-stories");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [savedPosts, setSavedPosts] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-posts");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });
  const listRef = useRef<any>(null);
  const cache = useRef(
    new CellMeasurerCache({
      fixedWidth: true,
      defaultHeight: 560,
    })
  );

  const [mutedUsers, setMutedUsers] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-muted-users");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const { profile: currentUserProfile, isVibesPro } = useSession();
  const currentUserProfileFromContext = currentUserProfile;
  const isStoryOwner = selectedStory?.authorId === currentUserProfileFromContext?.id;

  useEffect(() => {
    localStorage.setItem("metoyou-saved-stories", JSON.stringify(savedStories));
  }, [savedStories]);

  useEffect(() => {
    if (!selectedStory) {
      setStoryMenuOpen(false);
    }
  }, [selectedStory]);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storyEditorOpen, setStoryEditorOpen] = useState<boolean>(false);
  const [storyChoiceOpen, setStoryChoiceOpen] = useState<boolean>(false);
  const [storyMode, setStoryMode] = useState<"text" | "photo" | null>(null);
  const [storyText, setStoryText] = useState<string>(" ");
  const [storyDuration, setStoryDuration] = useState<number>(24);
  const [storyMusic, setStoryMusic] = useState<string | undefined>(undefined);
  const [storyVoice, setStoryVoice] = useState<string | undefined>(undefined);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const { posts, setPosts, savedScrollY, setSavedScrollY, selectedPostId, setSelectedPostId, loading } = useFeed();
  const filteredPosts = useMemo(
    () => posts.filter((post) => !mutedUsers.includes(post.author.id)),
    [posts, mutedUsers]
  );

  useEffect(() => {
    cache.current.clearAll();
    listRef.current?.recomputeRowHeights();
  }, [filteredPosts.length, selectedPostId]);
  const suppressAutoCloseRef = useRef(false);

  const handleShareStory = async () => {
    if (!selectedStory) return;

    try {
      const shareText = selectedStory.text ? `${selectedStory.name} says: ${selectedStory.text}` : `${selectedStory.name} shared a story on MeToYou.`;
      const shareUrl = window.location.href;

      if (navigator.share) {
        await navigator.share({
          title: `${selectedStory.name}'s story`,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
        alert("Story link copied to clipboard.");
      }
    } catch (error) {
      console.error("Unable to share story", error);
    } finally {
      setStoryMenuOpen(false);
    }
  };

  const handleSaveStory = () => {
    if (!selectedStory) return;
    setSavedStories((prev) =>
      prev.includes(selectedStory.id) ? prev : [...prev, selectedStory.id]
    );
    setStoryMenuOpen(false);
  };

  const [confirmDeleteStory, setConfirmDeleteStory] = useState(false);

  const handleReportStory = () => {
    setStoryMenuOpen(false);
    alert("This story has been reported. Our moderation team will review it shortly.");
  };

  const handleDeleteStory = () => {
    setStoryMenuOpen(false);
    setConfirmDeleteStory(true);
  };

  const confirmDeleteStoryAction = async () => {
    if (!selectedStory) return;
    await deleteStoryFromSupabase(selectedStory.id);
    setStories((prev) => prev.filter((story) => story.id !== selectedStory.id));
    setSelectedStory(null);
    setSelectedStoryIndex(null);
    setConfirmDeleteStory(false);
  };

  const cancelDeleteStory = () => {
    setConfirmDeleteStory(false);
  };

  const autoCloseTimeoutRef = useRef<number | null>(null);

  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    localStorage.setItem("metoyou-saved-posts", JSON.stringify(savedPosts));
  }, [savedPosts]);

  useEffect(() => {
    localStorage.setItem("metoyou-muted-users", JSON.stringify(mutedUsers));
  }, [mutedUsers]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isActive = true;

    const hydrateStories = async () => {
      const remoteStories = await fetchStoriesFromSupabase();
      if (!isActive) return;
      setStories(remoteStories.map(mapStoryRecord));
    };

    void hydrateStories();

    const channel = subscribeToStories((remoteStories) => {
      if (!isActive) return;
      setStories(remoteStories.map(mapStoryRecord));
    });

    return () => {
      isActive = false;
      channel.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!selectedStory) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [selectedStory]);

  // Restore saved scroll position when entering the Feed and save on unmount
  useEffect(() => {
    if (savedScrollY) {
      window.requestAnimationFrame(() => window.scrollTo(0, savedScrollY));
    }
    return () => {
      setSavedScrollY(window.scrollY || 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStories((prevStories) =>
        prevStories.filter((story) => story.expiresAt > Date.now())
      );
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const setAutoCloseSuppressed = (isSuppressed: boolean) => {
    suppressAutoCloseRef.current = isSuppressed;

    if (autoCloseTimeoutRef.current) {
      window.clearTimeout(autoCloseTimeoutRef.current);
      autoCloseTimeoutRef.current = null;
    }

    if (isSuppressed) {
      autoCloseTimeoutRef.current = window.setTimeout(() => {
        suppressAutoCloseRef.current = false;
        autoCloseTimeoutRef.current = null;
      }, 700);
    }
  };

  const openStoryAtIndex = (index: number) => {
    const story = stories[index];
    if (!story) return;

    setSelectedStory(story);
    setSelectedStoryIndex(index);
    setStoryProgress(0);

    setStories((prevStories) =>
      prevStories.map((item) => (item.id === story.id ? { ...item, viewedAt: Date.now() } : item))
    );
  };

  const showStoryNotice = (message: string) => {
    setStoryNotice(message);
    window.clearTimeout((window as Window & { __storyNoticeTimer?: number }).__storyNoticeTimer);
    (window as Window & { __storyNoticeTimer?: number }).__storyNoticeTimer = window.setTimeout(() => {
      setStoryNotice(null);
    }, 3000);
  };

  const goToNextStory = () => {
    if (selectedStoryIndex === null) return;
    const nextIndex = (selectedStoryIndex + 1) % stories.length;
    openStoryAtIndex(nextIndex);
  };

  const goToPreviousStory = () => {
    if (selectedStoryIndex === null) return;
    const previousIndex = (selectedStoryIndex - 1 + stories.length) % stories.length;
    openStoryAtIndex(previousIndex);
  };

  useEffect(() => {
    if (!selectedStory || selectedStoryIndex === null) return;

    if (selectedStory.voice) {
      showStoryNotice("Coming Soon");
      const delayTimer = window.setTimeout(() => {
        goToNextStory();
      }, 3000);

      return () => {
        window.clearTimeout(delayTimer);
      };
    }

    setStoryProgress(0);
    const progressInterval = window.setInterval(() => {
      setStoryProgress((prev) => {
        const next = prev + 100 / 50;
        return next >= 100 ? 100 : next;
      });
    }, 100);

    const advanceTimer = window.setTimeout(() => {
      goToNextStory();
    }, 5000);

    return () => {
      window.clearInterval(progressInterval);
      window.clearTimeout(advanceTimer);
    };
  }, [selectedStory?.id, selectedStoryIndex]);

  useEffect(() => {
    const handleScroll = () => {
      if (suppressAutoCloseRef.current) return;
      setSelectedPostId(null);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (autoCloseTimeoutRef.current) {
        window.clearTimeout(autoCloseTimeoutRef.current);
      }
    };
  }, [setSelectedPostId]);

  const updatePostById = (postId: string | number, patch: Partial<Post>) => {
    const idStr = (x: any) => String(x);

    setPosts((prev) => {
      // If the patch includes a new `id` (server-assigned), we must ensure
      // there are no duplicate posts that already have that id.
      if (patch.id !== undefined && patch.id !== null) {
        const updated = prev.map((post) => (idStr(post.id) === idStr(postId) ? { ...post, ...patch } : post));

        // Remove duplicates while preserving first-seen order
        const seen = new Set<string>();
        const merged: Post[] = [];
        for (const p of updated) {
          const key = idStr(p.id);
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(p);
        }

        return merged;
      }

      return prev.map((post) => (idStr(post.id) === idStr(postId) ? { ...post, ...patch } : post));
    });
  };

  const persistPost = async (
    postId: string | number,
    payload: { text?: string; image?: string; video?: string; audio?: string },
    onProgress?: (percent: number) => void
  ) => {
    const profile = currentUserProfile;
    if (!profile) return false;

    const startProgress = () => {
      let progress = 0;
      const intervalId = window.setInterval(() => {
        progress = Math.min(95, progress + Math.random() * 12 + 5);
        updatePostById(postId, {
          uploadState: "uploading",
          uploadProgress: Math.round(progress),
        });
        onProgress?.(Math.round(progress));
      }, 250);

      return intervalId;
    };

    const progressInterval = startProgress();

    try {
      let imageUrl: string | undefined;
      let audioUrl: string | undefined;

      if (payload.image) {
        imageUrl = await uploadImageToSupabase(payload.image, profile.id, (percent) => {
          onProgress?.(Math.max(0, Math.min(100, percent)));
        });
      }

      if (payload.audio) {
        audioUrl = await uploadAudioToSupabase(payload.audio, profile.id, (percent) => {
          onProgress?.(Math.max(0, Math.min(100, percent)));
        });
      }

      const saved = await savePostToSupabase({
        author_id: profile.id,
        text: payload.text ?? null,
        image_url: imageUrl ?? payload.image ?? null,
        video_url: payload.video ?? null,
        audio_url: audioUrl ?? null,
        media_type: payload.video ? "video" : payload.image ? "image" : audioUrl ? "audio" : null,
      });

      window.clearInterval(progressInterval);

      if (!saved) {
        throw new Error("Post save returned no data");
      }

      updatePostById(postId, {
        id: saved.id,
        author: { id: saved.author_id, username: profile.username },
        authorId: saved.author_id,
        author_id: saved.author_id,
        time: "Just now",
        created_at: saved.created_at ?? new Date().toISOString(),
        text: saved.text ?? payload.text ?? "",
        image: saved.image_url ?? imageUrl ?? payload.image ?? undefined,
        video: saved.video_url ?? payload.video ?? undefined,
        audio: saved.audio_url ?? audioUrl ?? payload.audio,
        comments: [],
        likes: saved.likes_count ?? 0,
        likes_count: saved.likes_count ?? 0,
        comments_count: saved.comments_count ?? 0,
        liked: false,
        highlighted: Boolean(saved.highlighted),
        uploadState: "completed",
        uploadProgress: 100,
        persisted: true,
      });

      const completedPostId = saved.id ?? postId;
      window.setTimeout(() => {
        updatePostById(completedPostId, {
          uploadState: undefined,
          uploadProgress: undefined,
        });
      }, 3000);

      return true;
    } catch (err) {
      window.clearInterval(progressInterval);
      console.error("Failed to save post to Supabase", err);

      if (!navigator.onLine) {
        updatePostById(postId, {
          uploadState: "waiting-network",
          uploadProgress: 0,
          persisted: false,
        });
      } else {
        updatePostById(postId, {
          uploadState: "failed",
          uploadProgress: 0,
          persisted: false,
        });
      }

      return false;
    }
  };

  const handlePost = async (
    text: string,
    image?: string,
    video?: string,
    audio?: string,
    onProgress?: (percent: number) => void
  ): Promise<boolean> => {
    const profile = currentUserProfile;
    if (!profile) return false;

    const optimisticId = `optimistic-${Date.now()}`;

    setPosts((prev) => [
      {
        id: optimisticId,
        author: { id: profile.id, username: profile.username },
        authorId: profile.id,
        author_id: profile.id,
        time: "Just now",
        created_at: new Date().toISOString(),
        text: text ?? "",
        image: image ?? undefined,
        video: video ?? undefined,
        audio: audio ?? undefined,
        comments: [],
        likes: 0,
        likes_count: 0,
        comments_count: 0,
        liked: false,
        highlighted: false,
        uploadState: "uploading",
        uploadProgress: 0,
        persisted: false,
      },
      ...prev,
    ]);

    if (!navigator.onLine) {
      updatePostById(optimisticId, {
        uploadState: "waiting-network",
        uploadProgress: 0,
      });
      return true;
    }

    void persistPost(optimisticId, { text, image, video, audio }, onProgress);
    return true;
  };

  const retryPost = async (postId: string | number) => {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    updatePostById(postId, {
      uploadState: "uploading",
      uploadProgress: 0,
      persisted: false,
    });

    if (!navigator.onLine) {
      updatePostById(postId, {
        uploadState: "waiting-network",
        uploadProgress: 0,
      });
      return;
    }

    void persistPost(postId, {
      text: post.text,
      image: post.image,
      video: post.video,
      audio: post.audio,
    });
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
    setStoryDuration(24);
    setStoryMusic(undefined);
    setStoryVoice(undefined);
  };

  const handleStoryImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setStoryMusic(undefined);
      setStoryVoice(undefined);
      setStoryEditorOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async () => {
    if (!selectedImage && !storyText.trim()) return;

    const profile = currentUserProfile;
    if (!profile) return;

    if (storyVoice || storyMusic) {
      setStoryCreateError("Audio stories are coming soon.");
      showStoryNotice("Coming Soon");
      return;
    }

    const displayName = profile?.username || "Maxi";
    const storyType: StoryType = selectedImage ? "photo" : storyVoice ? "voice" : "text";
    const isMediaStory = Boolean(selectedImage || storyVoice);

    setStoryCreateError(null);
    setStoryCreating(true);
    setStoryCreateProgress(0);
    setStoryCreateStatus(isMediaStory ? "Uploading" : "Posting");

    const progressSteps = isMediaStory
      ? [2, 4, 8, 16, 28, 42, 58, 74, 86, 94]
      : [10, 20, 40, 60, 80];
    let progressIndex = 0;

    const progressInterval = window.setInterval(() => {
      setStoryCreateProgress((current) => {
        if (current >= 95) return current;

        const next = progressSteps[Math.min(progressIndex, progressSteps.length - 1)];
        progressIndex += 1;
        return next;
      });
    }, 250);

    let createdStory: StoryRecord | null = null;

    try {
      createdStory = await createStoryToSupabase({
        authorId: profile.id,
        username: displayName,
        profilePic: profile.profilePic ?? null,
        text: storyText.trim() || undefined,
        image: selectedImage ?? undefined,
        voice: storyVoice,
        storyType,
        durationHours: storyDuration,
      });

      if (createdStory) {
        const mappedStory = mapStoryRecord(createdStory);
        setStories((prevStories) => [mappedStory, ...prevStories.filter((story) => story.id !== mappedStory.id)]);
      } else {
        setStoryCreateError("Story could not be posted right now.");
      }
    } catch (error) {
      console.error("Failed to create story", error);
      setStoryCreateError("Story could not be posted right now.");
    } finally {
      window.clearInterval(progressInterval);
      setStoryCreateProgress(100);
      setStoryCreateStatus(isMediaStory ? "Uploaded" : "Posted");
      setTimeout(() => {
        if (!createdStory) {
          setStoryCreateProgress(0);
          setStoryCreateStatus(null);
          return;
        }

        setStoryCreating(false);
        setStoryCreateStatus(null);
        setStoryCreateProgress(0);
        setStoryCreateError(null);
        setStoryEditorOpen(false);
        setStoryChoiceOpen(false);
        setStoryMode(null);
        setSelectedImage(null);
        setStoryText("");
        setStoryDuration(24);
        setStoryMusic(undefined);
        setStoryVoice(undefined);
      }, 400);
    }
  };

  const getTimeLeft = (expiresAt: number) => {
    const diff = expiresAt - currentTime;
    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  // Determine story card styling based on user's VibesPro status
  const storyCardRadius = isVibesPro ? "1.25rem" : "50% 50% 28% 28% / 18% 18% 70% 70%";
  const storyCardBorderClasses = isVibesPro
    ? "border-2 border-amber-300/25 shadow-[0_0_0_2px_rgba(212,175,55,0.22),0_24px_50px_rgba(212,175,55,0.18)]"
    : "";
  const storyPlaceholderGradient = isVibesPro ? "from-[#7C5CFF] via-[#00D4FF] to-[#D4AF37]" : "from-pink-400 via-purple-400 to-blue-400";
  const storyCardBgClass = isVibesPro ? "bg-[#111111]/85 text-white" : "bg-white/80 text-pink-500";
  const storyCardStyle = { borderRadius: storyCardRadius };

  // Normal feed content that can be wrapped by VibesProFeed theme
  const feedContent = (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-blue-100 via-pink-100 to-purple-100'} px-4 sm:px-6`}>
      {/* Dynamic Floating Navbar Container - only show if not VibesPro (VibesProFeed has its own navbar) */}
      {!isVibesPro && <Navbar />}

      <div className={`max-w-md mx-auto pb-24 space-y-5 ${isVibesPro ? 'pt-8' : 'pt-28'}`}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleStoryImage}
          className="hidden"
        />

        <input
          ref={musicInputRef}
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setStoryMusic(file.name);
          }}
          className="hidden"
        />

        {/* Stories Horizontal Tray */}
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
          {/* Add Story Button */}
          <button
            type="button"
            onClick={handleStoryClick}
            className={`w-26.5 h-38 md:w-35 md:h-50 shrink-0 flex flex-col items-center justify-center ${storyCardBorderClasses} ${storyCardBgClass} hover:scale-[1.02] active:scale-95 transition-all snap-start`}
            style={storyCardStyle}
          >
            <span className="text-2xl md:text-3xl font-light mb-0.5 md:mb-1">+</span>
            <span className="font-bold text-[10px] md:text-xs tracking-wide">Your Story</span>
          </button>

          {/* Render Active Stories */}
          {stories.map((story, index) => (
            <div
              key={story.id}
              onClick={() => openStoryAtIndex(index)}
              className={`w-26.5 h-38 md:w-35 md:h-50 shrink-0 relative overflow-hidden ${storyCardBorderClasses} text-white cursor-pointer hover:scale-[1.02] transition-transform snap-start ${story.viewedAt ? 'opacity-70 ring-1 ring-white/20' : ''}`}
              style={storyCardStyle}
            >
              {story.image ? (
                <img
                  src={story.image}
                  alt="story"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full bg-linear-to-br ${storyPlaceholderGradient} overflow-hidden p-3 flex items-center justify-center text-center`}>
                  <div className="relative w-full h-full rounded-2xl border border-white/10 bg-black/10 p-2 backdrop-blur-sm">
                    <div className="absolute inset-0 bg-white/5" />
                    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1 text-white">
                      {story.text ? (
                        <p
                          className="max-h-full overflow-hidden text-[10px] md:text-[12px] font-semibold leading-tight text-left"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 4,
                            WebkitBoxOrient: "vertical",
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {story.text}
                        </p>
                      ) : (
                        <>
                          <span className="text-[11px] md:text-xs uppercase tracking-[0.24em] text-white/70">Text Story</span>
                          <p className="text-[10px] md:text-[12px] font-semibold leading-tight opacity-80">No text content yet.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-black/10"></div>

              <div className="absolute bottom-2 left-0 right-0 text-center px-1 pointer-events-none">
                <p className="font-semibold text-[9px] md:text-xs truncate">{story.name}</p>
                <p className="text-[8px] md:text-[10px] opacity-80 mt-0.5">⏳ {getTimeLeft(story.expiresAt)}</p>
              </div>
            </div>
          ))}
        </div>

        <CreatePost onPost={handlePost} />

        {/* Dynamic Post Interaction Container */}
        <div
          onClick={() => selectedPostId !== null && setSelectedPostId(null)}
          className={`space-y-4 transition-all duration-300 ${selectedPostId !== null ? "relative z-10" : ""}`}
        >
          {selectedPostId !== null && (
            <div className="fixed inset-0 bg-black/5 z-0 pointer-events-none backdrop-blur-xs"></div>
          )}

          {loading && filteredPosts.length === 0 ? (
            isVibesPro ? (
              <VibesProFeedSkeleton count={5} />
            ) : (
              <FreeFeedSkeleton count={5} />
            )
          ) : (
            <WindowScroller>
              {({ height, isScrolling, onChildScroll, scrollTop }: any) => (
                <AutoSizer disableHeight>
                  {({ width }: any) => (
                    <List
                      autoHeight
                      width={width}
                      height={height}
                      rowCount={filteredPosts.length}
                      rowHeight={cache.current.rowHeight}
                      deferredMeasurementCache={cache.current}
                      overscanRowCount={3}
                      rowRenderer={({ index, key, parent, style }: any) => {
                        const post = filteredPosts[index];
                        const isSelected = selectedPostId === post.id;

                        return (
                          <CellMeasurer
                            cache={cache.current}
                            columnIndex={0}
                            key={key}
                            parent={parent}
                            rowIndex={index}
                          >
                            {({ registerChild }: any) => (
                              <div
                                ref={registerChild}
                                style={{ ...style, width: "100%" }}
                                className="mb-4 px-1 sm:px-2"
                              >
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAutoCloseSuppressed(true);
                                    setSelectedPostId(post.id);
                                  }}
                                  className={`transition-all duration-300 ${
                                    isSelected
                                      ? "scale-[1.02] z-20 shadow-xl"
                                      : selectedPostId !== null
                                      ? "blur-xs opacity-40 scale-[0.98] pointer-events-none"
                                      : ""
                                  }`}
                                >
                                  <PostCard
                                    author={post.author}
                                    isVibesPro={isVibesProEnabled(post.author as any)}
                                    variant={isVibesProEnabled(post.author as any) ? "gold" : "default"}
                                    postId={post.id}
                                    authorId={post.authorId ?? post.author.id}
                                    time={post.time}
                                    text={post.text}
                                    image={post.image}
                                    video={post.video}
                                    comments={post.comments}
                                    likes={post.likes ?? 0}
                                    liked={Boolean(post.liked)}
                                    isSelected={isSelected}
                                    onToggleLike={async () => {
                                      const profile = currentUserProfile;
                                      if (!profile) return;
                                      const userId = profile.id;
                                      const postId = String(post.id);
                                      const wasLiked = Boolean(post.liked);
                                      const previousLikes = Number(post.likes ?? post.likes_count ?? 0);
                                      const nextLiked = !wasLiked;
                                      const nextLikes = Math.max(0, previousLikes + (nextLiked ? 1 : -1));

                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id
                                            ? { ...p, likes: nextLikes, likes_count: nextLikes, liked: nextLiked }
                                            : p
                                        )
                                      );

                                      try {
                                        if (wasLiked) {
                                          const removed = await unlikePost(postId, userId);
                                          if (!removed) throw new Error("Unlike failed");
                                        } else {
                                          const liked = await likePost(postId, userId);
                                          if (!liked) throw new Error("Like failed");
                                        }

                                        const likesData = await getPostLikes(postId);
                                        const likesCount = (likesData || []).length;
                                        const userLikedNow = likesData.some((l) => l.user_id === userId);

                                        setPosts((prevPosts) =>
                                          prevPosts.map((p) =>
                                            p.id === post.id
                                              ? { ...p, likes: likesCount, likes_count: likesCount, liked: Boolean(userLikedNow) }
                                              : p
                                          )
                                        );
                                      } catch (error) {
                                        console.error("Failed to sync like state", error);
                                        setPosts((prevPosts) =>
                                          prevPosts.map((p) =>
                                            p.id === post.id
                                              ? { ...p, likes: previousLikes, likes_count: previousLikes, liked: wasLiked }
                                              : p
                                          )
                                        );
                                      }
                                    }}
                                    onSelectPost={() => {
                                      setAutoCloseSuppressed(true);
                                      setSelectedPostId(post.id);
                                    }}
                                    onClosePost={() => setSelectedPostId(null)}
                                    onRepost={() => {
                                      setPosts((prev) => [
                                        {
                                          ...post,
                                          id: Date.now(),
                                          author: { id: "user_001", username: "Maxi" },
                                          time: "Just now",
                                          highlighted: false,
                                        },
                                        ...prev,
                                      ]);
                                    }}
                                    onDeletePost={async () => {
                                      if (post.persisted) {
                                        try {
                                          await deletePostFromSupabase(String(post.id));
                                        } catch (err) {
                                          console.error("Failed to delete post from Supabase", err);
                                        }
                                      }
                                      setPosts((prev) => prev.filter((p) => p.id !== post.id));
                                      if (selectedPostId === post.id) setSelectedPostId(null);
                                    }}
                                    onRetryPost={() => {
                                      void retryPost(post.id);
                                    }}
                                    onEditPost={() => {
                                      const newText = window.prompt("Edit post text:", post.text || "");
                                      if (newText !== null) {
                                        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text: newText } : p)));
                                      }
                                    }}
                                    onDeleteImage={() => {
                                      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, image: undefined } : p)));
                                    }}
                                    onDeleteVideo={() => {
                                      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, video: undefined } : p)));
                                    }}
                                    onSavePost={() => {
                                      setSavedPosts((prev) =>
                                        prev.includes(String(post.id)) ? prev : [...prev, String(post.id)]
                                      );
                                      alert("Post saved!");
                                    }}
                                    onHighlight={() => {
                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id ? { ...p, highlighted: !p.highlighted } : p
                                        )
                                      );
                                    }}
                                    onInteractionActivity={setAutoCloseSuppressed}
                                    audio={post.audio}
                                    highlighted={Boolean(post.highlighted)}
                                    uploadState={post.uploadState}
                                    uploadProgress={post.uploadProgress}
                                    onMediaLoad={() => {
                                      try {
                                        // Clear cached measurement for this row and recompute height
                                        cache.current.clear(index, 0);
                                        listRef.current?.recomputeRowHeights(index);
                                        console.debug("Feed: media loaded, recomputed row", index, post.id);
                                      } catch (e) {
                                        // ignore
                                      }
                                    }}
                                    onMuteUser={() => {
                                      setMutedUsers((prev) =>
                                        prev.includes(post.author.id) ? prev : [...prev, post.author.id]
                                      );
                                      if (selectedPostId === post.id) setSelectedPostId(null);
                                      alert("User muted");
                                    }}
                                    onAddComment={async (comment) => {
                                      const profile = currentUserProfile;
                                      if (!profile) return;

                                      console.log("Feed: posting comment", { postId: post.id, profileId: profile.id, comment });
                                      try {
                                        const userResp = await supabase.auth.getUser();
                                        console.log("Feed: supabase.getUser()", userResp);
                                      } catch (e) {
                                        console.warn("Feed: supabase.getUser() error", e);
                                      }

                                      const added = await addComment(String(post.id), profile.id, comment.text, comment.voice);
                                      console.log("Feed: addComment result", added);
                                      if (!added) console.warn("Feed: addComment returned null — DB insert may have failed or been swallowed");

                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id
                                            ? {
                                                ...p,
                                                comments: [
                                                  ...(p.comments || []),
                                                  {
                                                    id: added?.id ?? Date.now(),
                                                    user: { id: profile.id, username: profile.username ?? profile.id },
                                                    text: added?.text ?? comment.text ?? "",
                                                    voice: comment.voice,
                                                    likes: 0,
                                                  },
                                                ],
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                    onDeleteComment={async (commentId) => {
                                      await deleteComment(String(commentId));
                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id
                                            ? { ...p, comments: p.comments?.filter((c) => c.id !== commentId) || [] }
                                            : p
                                        )
                                      );
                                    }}
                                    onEditComment={async (commentId, newText) => {
                                      await editComment(String(commentId), newText);
                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id
                                            ? { ...p, comments: p.comments?.map((c) => (c.id === commentId ? { ...c, text: newText } : c)) || [] }
                                            : p
                                        )
                                      );
                                    }}
                                    onLikeComment={(commentId) => {
                                      setPosts((prevPosts) =>
                                        prevPosts.map((p) =>
                                          p.id === post.id
                                            ? {
                                                ...p,
                                                comments: p.comments?.map((c) =>
                                                  c.id === commentId ? { ...c, likes: c.likes + 1 } : c
                                                ) || [],
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </CellMeasurer>
                        );
                      }}
                      onScroll={onChildScroll}
                      scrollTop={scrollTop}
                      isScrolling={isScrolling}
                      ref={listRef}
                      style={{ outline: "none" }}
                    />
                  )}
                </AutoSizer>
              )}
            </WindowScroller>
          )}
        </div>
      </div>

      {/* Story Fullscreen Viewer Modal */}
      {selectedStory && (
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center bg-black/95 backdrop-blur-md"
        >
          <button
            type="button"
            onClick={() => {
              setSelectedStory(null);
              setSelectedStoryIndex(null);
              setStoryProgress(0);
            }}
            className="absolute top-5 right-5 text-white/70 hover:text-white text-3xl font-light transition-colors z-50"
          >
            ✕
          </button>

          <div className="relative w-[calc(100vw-1rem)] h-[calc(100vh-2rem)] sm:w-screen sm:h-screen overflow-hidden bg-slate-900 rounded-[1.25rem] sm:rounded-none">
            <div className="absolute inset-0 z-10 rounded-[1.25rem] sm:rounded-none border border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_0_1px_rgba(255,255,255,0.06)_inset,0_18px_45px_rgba(0,0,0,0.35)] pointer-events-none" />
            <div className="absolute inset-3 z-10 rounded-2xl sm:rounded-none border border-white/15 pointer-events-none" />
            <div className="absolute inset-6 z-10 rounded-[0.9rem] sm:rounded-none border border-fuchsia-400/20 pointer-events-none" />
            <div className="absolute inset-x-0 top-0 z-50 flex gap-1.5 p-2">
              {stories.map((_, index) => (
                <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full bg-white transition-all duration-100 ease-linear"
                    style={{ width: `${index < (selectedStoryIndex ?? 0) ? 100 : index === (selectedStoryIndex ?? 0) ? storyProgress : 0}%` }}
                  />
                </div>
              ))}
            </div>

            <div className="absolute inset-0 z-40 flex">
              <button type="button" className="h-full w-1/2" aria-label="Previous story" onClick={goToPreviousStory} />
              <button type="button" className="h-full w-1/2" aria-label="Next story" onClick={goToNextStory} />
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setStoryMenuOpen((open) => !open);
              }}
              className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white shadow-md shadow-black/40 transition hover:bg-white/10"
              aria-label="Story actions"
            >
              <span className="text-lg leading-none">⋯</span>
            </button>

            {storyMenuOpen && selectedStory && (
              <div className="absolute top-16 left-4 z-50 min-w-45 rounded-2xl border border-white/15 bg-slate-950/95 p-2 shadow-2xl shadow-black/50">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleShareStory();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                >
                  Share story
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleSaveStory();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                >
                  {savedStories.includes(selectedStory.id) ? "Saved" : "Save story"}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleReportStory();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-left text-sm text-white hover:bg-white/10 transition"
                >
                  Report story
                </button>
                {isStoryOwner && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteStory();
                    }}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm text-rose-200 hover:bg-rose-500/20 transition"
                  >
                    Delete story
                  </button>
                )}
              </div>
            )}

            {confirmDeleteStory && selectedStory && (
              <div className="fixed inset-0 z-10001 flex items-center justify-center bg-black/80 p-4">
                <div className="w-full max-w-sm rounded-4xl border border-white/20 bg-slate-950 p-6 shadow-2xl shadow-black/60">
                  <p className="text-lg font-semibold text-white">Delete this story?</p>
                  <p className="mt-3 text-sm text-slate-300">This will permanently remove the story from your story tray. Are you sure?</p>
                  <div className="mt-6 flex flex-wrap gap-3 justify-end">
                    <button
                      type="button"
                      onClick={cancelDeleteStory}
                      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteStoryAction}
                      className="rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
                    >
                      Delete story
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedStory.image ? (
              <div className="flex items-center justify-center w-full h-full bg-slate-900 relative z-30">
                <img
                  src={selectedStory.image}
                  alt="story content"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="relative z-30 w-full h-full bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 px-6 py-8 text-white flex items-center justify-center">
                <div
                  className="max-w-[85%] max-h-[70vh] overflow-y-auto whitespace-pre-wrap wrap-break-word text-center text-2xl md:text-3xl font-semibold leading-relaxed scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent"
                  style={{
                    overscrollBehavior: "contain",
                    textShadow: "-1px -1px 0 rgba(0,0,0,0.45), 1px -1px 0 rgba(0,0,0,0.45), -1px 1px 0 rgba(0,0,0,0.45), 1px 1px 0 rgba(0,0,0,0.45)",
                  }}
                >
                  {selectedStory.text}
                </div>
              </div>
            )}

            <div className="absolute inset-0 z-20 bg-linear-to-t from-black/80 via-black/20 to-black/40"></div>

            <div className="absolute left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 text-xs text-white/70">
              <span className="rounded-full bg-black/30 px-2 py-1">⏳ {getTimeLeft(selectedStory.expiresAt)}</span>
              {selectedStory.music && <span className="rounded-full bg-black/30 px-2 py-1">🎵 {selectedStory.music}</span>}
            </div>

            <div className="absolute bottom-6 left-0 right-0 z-50 px-4 text-center text-white">
              <div className="mx-auto inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
                <h2 className="text-xl font-bold tracking-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
                  {currentUserProfile?.username && selectedStory.name === currentUserProfile.username ? "Your Story" : selectedStory.name}
                </h2>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Type Choice Overlay */}
      {storyChoiceOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setStoryChoiceOpen(false)}></div>

          <div className="relative w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl space-y-4">
            <h3 className="text-center font-bold text-base text-slate-800">Create Story</h3>
            <p className="text-sm text-center text-slate-500">Choose what you want to share.</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openStoryEditor("text")}
                className="py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
              >
                Text
              </button>
              <button
                type="button"
                onClick={() => openStoryEditor("photo")}
                className="py-3 rounded-xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-semibold shadow-md"
              >
                Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {storyNotice ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="rounded-3xl border border-white/20 bg-white/95 px-6 py-5 text-center shadow-2xl">
            <p className="text-lg font-black text-slate-900">Coming Soon</p>
            <p className="mt-1 text-sm text-slate-600">Audio stories are being prepared for a future update.</p>
          </div>
        </div>
      ) : null}

      {/* Story Builder/Editor Overlay */}
      {storyEditorOpen && (selectedImage || storyMode === "text") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => {setStoryEditorOpen(false); setStoryMode(null); setSelectedImage(null); setStoryText(""); setStoryDuration(24); setStoryMusic(undefined); setStoryVoice(undefined);}}></div>

          <div className="relative w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="w-full aspect-square overflow-hidden rounded-xl bg-slate-100">
              {selectedImage ? (
                <img src={selectedImage} alt="preview" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 overflow-y-auto p-4 flex items-center justify-center text-white font-semibold text-center">
                  <div className="w-full whitespace-pre-wrap wrap-break-word text-xl leading-relaxed">
                    {storyText.trim() ? storyText.trim() : "Text Story"}
                  </div>
                </div>
              )}
            </div>

            <h3 className="text-center font-bold text-base text-slate-800">Create Story</h3>

            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Drop a vibe text onto your story..."
              className="w-full max-h-52 overflow-y-auto text-sm border border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-slate-400 focus:border-pink-300 transition-colors"
              rows={2}
            />

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  showStoryNotice("Coming Soon");
                }}
                className="bg-purple-50 text-purple-600 py-2.5 rounded-xl hover:bg-purple-100 transition-colors"
              >
                🎵 {storyMusic ? "Change Audio" : "Add Music"}
              </button>
              <button
                type="button"
                onClick={() => {
                  showStoryNotice("Coming Soon");
                }}
                className="py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                🎙 Record Voice
              </button>
            </div>

            {storyCreateError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                {storyCreateError}
              </p>
            ) : null}

            {storyMusic && <p className="text-[11px] text-purple-600 font-medium truncate px-1">Selected: {storyMusic}</p>}
            {storyVoice && <audio controls src={storyVoice} className="w-full h-6 opacity-80" />}

            {/* Expiry Time Selectors */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 block px-1">Story Lifespan</span>
              <div className="flex justify-between gap-1">
                {[2, 4, 8, 12, 24].map((h) => (
                  <button
                    key={h}
                    onClick={() => setStoryDuration(h)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      storyDuration === h
                        ? "bg-pink-500 border-pink-500 text-white shadow-xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {storyCreating && storyCreateStatus ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>{storyCreateStatus}</span>
                  <span>{storyCreateProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-200"
                    style={{ width: `${storyCreateProgress}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  if (storyCreating) return;
                  setStoryEditorOpen(false);
                  setStoryMode(null);
                  setSelectedImage(null);
                  setStoryText("");
                  setStoryDuration(24);
                  setStoryMusic(undefined);
                  setStoryVoice(undefined);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                disabled={storyCreating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateStory}
                className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-md shadow-purple-200 active:scale-95 transition-transform"
                disabled={storyCreating}
              >
                {storyCreating ? "Working..." : "Post Story 🚀"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Wrap with VibesProFeed if user is premium, otherwise return normal feed
  if (isVibesPro) {
    return (
      <VibesProFeed hideNavbar={Boolean(selectedStory)}>
        {feedContent}
      </VibesProFeed>
    );
  }

  return feedContent;
}