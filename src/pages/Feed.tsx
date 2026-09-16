import Navbar from "../components/Navbar";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { AutoSizer, CellMeasurer, CellMeasurerCache, List, WindowScroller } from "react-virtualized";
import { useLocation, useNavigate } from "react-router-dom";
import { useFeed, type Post as FeedPost } from "../contexts/FeedContext";
import { useSession } from "../contexts/SessionContext";
import { VibesProFeed } from "../themes/vibespro";
import { useAppInit } from "../contexts/AppInitContext";
import { isVibesProEnabled } from "../lib/vibesPro";
import { supabase } from "../lib/supabase";

import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";
import { FreeFeedSkeleton, VibesProFeedSkeleton } from "../components/skeletons/FeedSkeletons";
import { savePostToSupabase, deletePostFromSupabase, updatePostInSupabase, uploadAudioToSupabase, uploadImageVariantsToSupabase, fetchPostByIdFromSupabase } from "../lib/postApi";
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
  imageOriginal?: string;
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
  imageOriginal: story.image_original_url ?? undefined,
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
  const feedInitializing = !appReady || !profileReady;
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const voiceInputRef = useRef<HTMLInputElement>(null);
  const [audioChoiceOpen, setAudioChoiceOpen] = useState(false);
  const [, setAudioMode] = useState<"record" | "upload" | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [focusedPost, setFocusedPost] = useState<FeedPost | null>(null);
  const requestedPostId = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const value = params.get("postId");
    return value ? String(value) : null;
  }, [location.search]);
  const shouldFocusOnPost = Boolean(requestedPostId);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyCreateProgress, setStoryCreateProgress] = useState(0);
  const [storyCreateStatus, setStoryCreateStatus] = useState<string | null>(null);
  const [storyCreateError, setStoryCreateError] = useState<string | null>(null);
  const [storyNotice, setStoryNotice] = useState<string | null>(null);
  const [storiesLoading, setStoriesLoading] = useState(true);
  const [savedStories, setSavedStories] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-stories");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [savedPosts, setSavedPosts] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-posts");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });
  const listRef = useRef<any>(null);
  const previousFilteredLengthRef = useRef(0);
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

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [audioTrimStart, setAudioTrimStart] = useState(0);
  const [audioTrimEnd, setAudioTrimEnd] = useState(35);
  const [audioSelectionError, setAudioSelectionError] = useState<string | null>(null);
  const [activeTrimHandle, setActiveTrimHandle] = useState<"start" | "end" | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const feedTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const maxTrimDuration = Math.min(audioDuration ?? 35, 35);

  const updateTrimSelection = useCallback((clientX: number) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const nextValue = ratio * maxTrimDuration;

    if (activeTrimHandle === "start") {
      setAudioTrimStart(Math.min(Math.max(0, nextValue), Math.max(0, audioTrimEnd - 0.1)));
    } else if (activeTrimHandle === "end") {
      setAudioTrimEnd(Math.max(Math.min(maxTrimDuration, nextValue), audioTrimStart + 0.1));
    }
  }, [activeTrimHandle, audioTrimEnd, audioTrimStart, maxTrimDuration]);

  useEffect(() => {
    if (!activeTrimHandle) return;

    const handlePointerMove = (event: PointerEvent) => updateTrimSelection(event.clientX);
    const handlePointerUp = () => setActiveTrimHandle(null);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeTrimHandle, updateTrimSelection]);

  useEffect(() => {
    localStorage.setItem("metoyou-saved-stories", JSON.stringify(savedStories));
  }, [savedStories]);

  useEffect(() => {
    if (!selectedStory) {
      setStoryMenuOpen(false);
    }
  }, [selectedStory]);

  const [storyEditorOpen, setStoryEditorOpen] = useState<boolean>(false);
  const [storyChoiceOpen, setStoryChoiceOpen] = useState<boolean>(false);
  const [storyMode, setStoryMode] = useState<"text" | "photo" | null>(null);
  const [storyText, setStoryText] = useState<string>(" ");
  const [storyDuration, setStoryDuration] = useState<number>(24);
  const [storyMusic, setStoryMusic] = useState<string | undefined>(undefined);
  const [storyVoice, setStoryVoice] = useState<string | undefined>(undefined);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("metoyou:create-story-visibility", {
      detail: storyChoiceOpen || storyEditorOpen,
    }));
  }, [storyChoiceOpen, storyEditorOpen]);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const { posts, setPosts, savedScrollY, setSavedScrollY, selectedPostId, setSelectedPostId, loading, loadMorePosts, hasMore, feedError } = useFeed();
  const filteredPosts = useMemo(() => {
    const basePosts = posts.filter((post) => !mutedUsers.includes(post.author.id));

    if (!requestedPostId) return basePosts;

    return basePosts.filter((post) => String(post.id) === requestedPostId);
  }, [posts, mutedUsers, requestedPostId]);

  useEffect(() => {
    const previousLength = previousFilteredLengthRef.current;
    const isAppend = filteredPosts.length > previousLength && previousLength > 0;

    if (isAppend) {
      listRef.current?.recomputeRowHeights(previousLength);
    } else {
      cache.current.clearAll();
      listRef.current?.recomputeRowHeights();
    }

    previousFilteredLengthRef.current = filteredPosts.length;
  }, [filteredPosts.length, selectedPostId]);

  useEffect(() => {
    if (!requestedPostId) {
      setFocusedPost(null);
      setSelectedPostId(null);
      return;
    }

    let active = true;

    const loadFocusedPost = async () => {
      const existing = posts.find((post) => String(post.id) === requestedPostId);
      if (existing) {
        if (active) {
          setFocusedPost(existing);
          setSelectedPostId(requestedPostId);
        }
        return;
      }

      const record = await fetchPostByIdFromSupabase(requestedPostId);
      if (!active) return;

      if (!record) {
        setFocusedPost(null);
        setSelectedPostId(requestedPostId);
        return;
      }

      const mappedPost: FeedPost = {
        id: record.id,
        author: {
          id: record.author_id,
          username: record.profiles?.username ?? record.author_id,
          avatar: record.profiles?.profile_pic ?? undefined,
          is_vibes_pro: isVibesProEnabled(record.profiles as any),
        },
        authorId: record.author_id,
        author_id: record.author_id,
        time: "just now",
        created_at: record.created_at,
        text: record.text ?? "",
        image: record.image_url ?? undefined,
        imageOriginal: record.image_original_url ?? undefined,
        video: record.video_url ?? undefined,
        audio: record.audio_url ?? undefined,
        comments: [],
        likes: record.likes_count ?? 0,
        likes_count: record.likes_count ?? 0,
        comments_count: record.comments_count ?? 0,
        liked: false,
        highlighted: Boolean(record.highlighted),
        persisted: true,
      };

      setFocusedPost(mappedPost);
      setSelectedPostId(requestedPostId);
    };

    void loadFocusedPost();

    return () => {
      active = false;
    };
  }, [posts, requestedPostId, setSelectedPostId]);

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
      try {
        const remoteStories = await fetchStoriesFromSupabase();
        if (!isActive) return;
        setStories(remoteStories.map(mapStoryRecord));
      } finally {
        if (isActive) setStoriesLoading(false);
      }
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
    payload: { text?: string; image?: string; originalImage?: string; video?: string; audio?: string },
    onProgress?: (percent: number) => void
  ) => {
    const profile = currentUserProfile;
    if (!profile) return false;
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      throw authError ?? new Error("Authentication is required to create a post.");
    }
    const authorId = authData.user.id;

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
      let imageOriginalUrl: string | undefined;
      let audioUrl: string | undefined;

      if (payload.image) {
        const uploadedImages = await uploadImageVariantsToSupabase(payload.image, payload.originalImage, authorId, (percent) => {
          onProgress?.(Math.max(0, Math.min(100, percent)));
        });
        imageUrl = uploadedImages.optimizedUrl ?? undefined;
        imageOriginalUrl = uploadedImages.originalUrl ?? undefined;
      }

      if (payload.audio) {
        audioUrl = await uploadAudioToSupabase(payload.audio, authorId, (percent) => {
          onProgress?.(Math.max(0, Math.min(100, percent)));
        });
      }

      const saved = await savePostToSupabase({
        author_id: authorId,
        text: payload.text ?? null,
        image_url: imageUrl ?? payload.image ?? null,
        image_original_url: imageOriginalUrl ?? payload.originalImage ?? imageUrl ?? payload.image ?? null,
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
        imageOriginal: saved.image_original_url ?? imageOriginalUrl ?? payload.originalImage ?? imageUrl ?? payload.image ?? undefined,
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
    onProgress?: (percent: number) => void,
    originalImage?: string
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

    void persistPost(optimisticId, { text, image, originalImage, video, audio }, onProgress);
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

  const resetStoryComposer = () => {
    setStoryEditorOpen(false);
    setStoryMode(null);
    setSelectedImage(null);
    setSelectedAudioFile(null);
    setAudioDuration(null);
    setAudioTrimStart(0);
    setAudioTrimEnd(35);
    setAudioSelectionError(null);
    setStoryText("");
    setStoryDuration(24);
    setStoryMusic(undefined);
    setStoryVoice(undefined);
    setAudioChoiceOpen(false);
    setAudioMode(null);
    setIsRecordingVoice(false);
    audioChunksRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const getAudioDuration = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Audio playback is not supported in this browser");

    const audioContext = new AudioContextCtor();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      return decoded.duration;
    } finally {
      await audioContext.close();
    }
  };

  const createTrimmedAudioBlob = async (file: File, start: number, end: number) => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) throw new Error("Audio playback is not supported in this browser");

    const audioContext = new AudioContextCtor();
    try {
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const safeStart = Math.max(0, Math.min(start, decoded.duration));
      const safeEnd = Math.max(safeStart + 0.1, Math.min(end, decoded.duration));
      const duration = safeEnd - safeStart;

      const offlineContext = new OfflineAudioContext(decoded.numberOfChannels, Math.max(1, Math.floor(duration * decoded.sampleRate)), decoded.sampleRate);
      const source = offlineContext.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineContext.destination);
      source.start(0, safeStart, duration);
      const rendered = await offlineContext.startRendering();

      const wavBuffer = new ArrayBuffer(44 + rendered.length * rendered.numberOfChannels * 2);
      const view = new DataView(wavBuffer);
      const writeString = (offset: number, value: string) => {
        for (let i = 0; i < value.length; i += 1) {
          view.setUint8(offset + i, value.charCodeAt(i));
        }
      };

      writeString(0, "RIFF");
      view.setUint32(4, 36 + rendered.length * rendered.numberOfChannels * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, rendered.numberOfChannels, true);
      view.setUint32(24, rendered.sampleRate, true);
      view.setUint32(28, rendered.sampleRate * rendered.numberOfChannels * 2, true);
      view.setUint16(32, rendered.numberOfChannels * 2, true);
      view.setUint16(34, 16, true);
      writeString(36, "data");
      view.setUint32(40, rendered.length * rendered.numberOfChannels * 2, true);

      let offset = 44;
      for (let i = 0; i < rendered.length; i += 1) {
        for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
          const sample = Math.max(-1, Math.min(1, rendered.getChannelData(channel)[i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
          offset += 2;
        }
      }

      return new Blob([wavBuffer], { type: "audio/wav" });
    } finally {
      await audioContext.close();
    }
  };

  const handleAudioSelection = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setAudioSelectionError("Audio files must be smaller than 20MB.");
      return;
    }

    try {
      setAudioSelectionError(null);
      setStoryCreateError(null);
      setSelectedAudioFile(file);
      const duration = await getAudioDuration(file);
      const cappedDuration = Math.min(duration, 35);
      setAudioDuration(duration);
      setAudioTrimStart(0);
      setAudioTrimEnd(cappedDuration);
      setStoryEditorOpen(true);
      if (storyVoice?.startsWith("blob:")) {
        URL.revokeObjectURL(storyVoice);
      }
      const trimmedBlob = await createTrimmedAudioBlob(file, 0, cappedDuration);
      const audioUrl = URL.createObjectURL(trimmedBlob);
      setStoryVoice(audioUrl);
      setStoryMusic(undefined);
    } catch (error) {
      console.error("Failed to prepare audio", error);
      setAudioSelectionError("We could not prepare this audio file. Please try another one.");
    }
  };

  const handleApplyAudioTrim = async () => {
    if (!selectedAudioFile) return;

    try {
      setAudioSelectionError(null);
      if (storyVoice?.startsWith("blob:")) {
        URL.revokeObjectURL(storyVoice);
      }
      const trimmedBlob = await createTrimmedAudioBlob(selectedAudioFile, audioTrimStart, audioTrimEnd);
      const audioUrl = URL.createObjectURL(trimmedBlob);
      setStoryVoice(audioUrl);
    } catch (error) {
      console.error("Failed to trim audio", error);
      setAudioSelectionError("We could not trim this audio file.");
    }
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
    if (!selectedImage && !storyText.trim() && !storyVoice && !storyMusic) return;

    const profile = currentUserProfile;
    if (!profile) return;

    if (!selectedImage && !storyText.trim() && !storyVoice && !storyMusic) {
      setStoryCreateError("Add some content to your story.");
      return;
    }

    const displayName = profile?.username || "Maxi";
    const storyType: StoryType = selectedImage ? "photo" : storyVoice ? "voice" : storyMusic ? "voice" : "text";
    const isMediaStory = Boolean(selectedImage || storyVoice || storyMusic);

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
        originalImage: selectedImage ?? undefined,
        voice: storyVoice || storyMusic,
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
        resetStoryComposer();
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
  const storyPlaceholderGradient = isVibesPro ? "from-[#7C5CFF] via-[#00D4FF] to-[#D4AF37]" : "from-sky-400 via-cyan-400 to-blue-500";
  const storyCardBgClass = isVibesPro ? "bg-[#111111]/85 text-white" : "bg-white/80 text-sky-600";
  const storyCardStyle = { borderRadius: storyCardRadius };

  const handleFeedTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, video")) {
      feedTouchStartRef.current = null;
      return;
    }
    const touch = event.changedTouches[0];
    feedTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleFeedTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = feedTouchStartRef.current;
    feedTouchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (deltaX <= -80 && Math.abs(deltaX) > Math.abs(deltaY) * 1.35) {
      navigate("/clips", { replace: true });
    }
  };

  const focusedPostContent = shouldFocusOnPost ? (
    <div onTouchStart={handleFeedTouchStart} onTouchEnd={handleFeedTouchEnd} className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-sky-100 via-white to-cyan-100'} px-4 sm:px-6`}>
      <div className="mx-auto max-w-md pb-24 pt-4">
        {focusedPost ? (
          <div className={`rounded-[32px] border p-2 shadow-2xl backdrop-blur-md ${isVibesPro ? 'border-[#D4AF37]/20 bg-[#181818]' : 'border-white/40 bg-white/70'}`}>
            <PostCard
              author={focusedPost.author}
              isVibesPro={isVibesProEnabled(focusedPost.author as any)}
              variant={isVibesProEnabled(focusedPost.author as any) ? "gold" : "default"}
              postId={focusedPost.id}
              authorId={focusedPost.authorId ?? focusedPost.author.id}
              time={focusedPost.time}
              text={focusedPost.text}
              image={focusedPost.image}
              video={focusedPost.video}
              comments={focusedPost.comments}
              likes={focusedPost.likes ?? 0}
              liked={Boolean(focusedPost.liked)}
              isSelected={true}
              onToggleLike={() => undefined}
              onSelectPost={() => undefined}
              onClosePost={() => undefined}
              onRepost={() => undefined}
              onSavePost={() => undefined}
              onMuteUser={() => undefined}
              onDeletePost={() => undefined}
              onRetryPost={() => undefined}
              onEditPost={() => undefined}
              onDeleteImage={() => undefined}
              onDeleteVideo={() => undefined}
              onHighlight={() => undefined}
              audio={focusedPost.audio}
            />
          </div>
        ) : (
          <div className={`rounded-[32px] border p-8 text-center text-sm shadow-2xl backdrop-blur-md ${isVibesPro ? 'border-[#D4AF37]/20 bg-[#181818] text-white/80' : 'border-white/40 bg-white/70 text-slate-600'}`}>
            Loading post...
          </div>
        )}
      </div>
    </div>
  ) : null;

  // Normal feed content that can be wrapped by VibesProFeed theme
  const feedContent = (
    <div onTouchStart={handleFeedTouchStart} onTouchEnd={handleFeedTouchEnd} className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-sky-100 via-white to-cyan-100'} px-4 sm:px-6`}>
      {!shouldFocusOnPost && !isVibesPro && <Navbar />}

      <div className={`max-w-md mx-auto pb-24 space-y-5 ${shouldFocusOnPost ? 'pt-4' : isVibesPro ? 'pt-8' : 'pt-28'}`}>
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
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const uploadedUrl = await uploadAudioToSupabase(file);
              setStoryVoice(uploadedUrl);
              setStoryMusic(undefined);
              setStoryEditorOpen(true);
            } catch (error) {
              console.error("Failed to upload audio", error);
              setStoryCreateError("Could not upload audio. Please try again.");
            }
          }}
          className="hidden"
        />

        <input
          ref={voiceInputRef}
          type="file"
          accept="audio/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await handleAudioSelection(file);
          }}
          className="hidden"
        />

        {!shouldFocusOnPost && (
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
          {storiesLoading && stories.length === 0
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={`story-skeleton-${index}`} className="w-26.5 h-38 md:w-35 md:h-50 shrink-0 animate-pulse rounded-2xl bg-white/50" />
              ))
            : stories.map((story, index) => (
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
                  loading="lazy"
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
        )}

        {!shouldFocusOnPost && <CreatePost onPost={handlePost} />}

        {/* Dynamic Post Interaction Container */}
        <div
          onClick={() => selectedPostId !== null && setSelectedPostId(null)}
          className={`space-y-4 transition-all duration-300 ${selectedPostId !== null ? "relative z-10" : ""}`}
        >
          {selectedPostId !== null && (
            <div className="fixed inset-0 bg-black/5 z-0 pointer-events-none backdrop-blur-xs"></div>
          )}

          {(feedInitializing || loading) && filteredPosts.length === 0 ? (
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
                      rowRenderer={({ index, parent, style }: any) => {
                        const post = filteredPosts[index];
                        const isSelected = selectedPostId === post.id;

                        return (
                          <CellMeasurer
                            cache={cache.current}
                            columnIndex={0}
                            key={String(post.id)}
                            parent={parent}
                            rowIndex={index}
                          >
                            {({ registerChild }: any) => (
                              <div
                                ref={registerChild}
                                style={{ ...style, width: "100%" }}
                                className="mb-4 px-1 sm:px-2"
                                data-post-id={String(post.id)}
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
                                    imageOriginal={post.imageOriginal}
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
                                    onEditPost={async (nextText) => {
                                      const trimmed = nextText.trim();
                                      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, text: trimmed } : p)));

                                      if (post.persisted && post.id) {
                                        try {
                                          await updatePostInSupabase(String(post.id), { text: trimmed });
                                        } catch (err) {
                                          console.error("Failed to update post in Supabase", err);
                                        }
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
                      onRowsRendered={({ stopIndex }: any) => {
                        if (hasMore && stopIndex >= filteredPosts.length - 3) {
                          void loadMorePosts();
                        }
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
          {loading && filteredPosts.length > 0 && (
            isVibesPro ? <VibesProFeedSkeleton count={1} /> : <FreeFeedSkeleton count={1} />
          )}
          {feedError && (
            <div className="mt-4 flex items-center justify-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 shadow-sm">
              <span>{feedError}</span>
              <button
                type="button"
                onClick={() => void loadMorePosts()}
                className="font-semibold underline underline-offset-2"
              >
                Retry
              </button>
            </div>
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
            <div className="absolute inset-6 z-10 rounded-[0.9rem] sm:rounded-none border border-sky-400/20 pointer-events-none" />
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
                  src={selectedStory.imageOriginal ?? selectedStory.image}
                  alt="story content"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="relative z-30 w-full h-full bg-linear-to-br from-sky-500 via-cyan-500 to-blue-500 px-6 py-8 text-white flex items-center justify-center">
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setStoryChoiceOpen(false)}></div>

          {isVibesPro ? (
            <div className="relative w-full max-w-xs rounded-3xl border border-white/10 bg-[#111111] p-5 text-white shadow-2xl">
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
                  className="rounded-2xl bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20"
                >
                  Photo
                </button>
              </div>
            </div>
          ) : (
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
                  className="py-3 rounded-xl bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 text-white font-semibold shadow-md"
                >
                  Photo
                </button>
              </div>
            </div>
          )}
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

      {audioChoiceOpen && isVibesPro && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setAudioChoiceOpen(false)} />
          <div className="relative w-full max-w-xs rounded-3xl border border-white/10 bg-[#111111] p-5 text-white shadow-2xl">
            <h2 className="text-lg font-bold">Add Audio</h2>
            <p className="mt-2 text-sm text-white/70">Choose how you want to add your voice story.</p>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                onClick={() => {
                  setAudioMode("record");
                  setAudioChoiceOpen(false);
                  setStoryCreateError(null);
                  void (async () => {
                    try {
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      streamRef.current = stream;
                      const recorder = new MediaRecorder(stream);
                      mediaRecorderRef.current = recorder;
                      audioChunksRef.current = [];
                      recorder.ondataavailable = (event) => {
                        if (event.data.size > 0) audioChunksRef.current.push(event.data);
                      };
                      recorder.onstop = async () => {
                        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                        const file = new File([blob], `voice-story-${Date.now()}.webm`, { type: "audio/webm" });
                        const uploadedUrl = await uploadAudioToSupabase(file);
                        setStoryVoice(uploadedUrl);
                        setStoryMusic(undefined);
                        setStoryEditorOpen(true);
                        stream.getTracks().forEach((track) => track.stop());
                        streamRef.current = null;
                      };
                      recorder.start();
                      setIsRecordingVoice(true);
                    } catch (error) {
                      console.error("Failed to start recording", error);
                      setStoryCreateError("Microphone access was denied.");
                    }
                  })();
                }}
                className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15"
              >
                Record Voice
              </button>
              <button
                type="button"
                onClick={() => {
                  setAudioMode("upload");
                  setAudioChoiceOpen(false);
                  voiceInputRef.current?.click();
                }}
                className="rounded-2xl bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white"
              >
                Upload Audio
              </button>
            </div>
          </div>
        </div>
      )}

      {isRecordingVoice && isVibesPro && (
        <div className="fixed inset-x-0 bottom-6 z-75 flex justify-center px-4">
          <div className="rounded-full border border-white/10 bg-[#111111]/95 px-4 py-2 text-sm font-semibold text-white shadow-xl">
            Recording… Tap the audio button again to stop
          </div>
        </div>
      )}

      {/* Story Builder/Editor Overlay */}
      {storyEditorOpen && (selectedImage || storyMode === "text" || storyVoice || storyMusic) && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => {setStoryEditorOpen(false); setStoryMode(null); setSelectedImage(null); setStoryText(""); setStoryDuration(24); setStoryMusic(undefined); setStoryVoice(undefined);}}></div>

          {isVibesPro ? (
            <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#111111] p-5 text-white shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Share Story</h2>
                  <p className="mt-1 text-sm text-white/70">Add a photo or text story for your friends.</p>
                </div>
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
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/15"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-4">
                {selectedImage ? (
                  <div className="flex max-h-[60vh] items-center justify-center overflow-hidden rounded-3xl bg-black/40">
                    <img src={selectedImage} alt="Story preview" className="max-h-[60vh] w-full object-contain" />
                  </div>
                ) : (
                  <textarea
                    value={storyText}
                    onChange={(e) => setStoryText(e.target.value)}
                    rows={5}
                    placeholder="Write your story..."
                    className="w-full rounded-3xl border border-white/10 bg-black/60 p-4 text-sm text-white outline-none placeholder:text-white/40"
                  />
                )}

                {storyCreateError ? (
                  <p className="text-sm text-red-400">{storyCreateError}</p>
                ) : null}

                {storyVoice ? (
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-[#E8C96F]/70">Audio clip</div>
                        <div className="mt-1 text-xs text-white/70">Drag the handles to choose the part you want to upload.</div>
                      </div>
                      {selectedAudioFile ? (
                        <div className="text-[11px] text-white/60">{selectedAudioFile.name}</div>
                      ) : null}
                    </div>

                    <audio controls src={storyVoice} className="mt-3 h-8 w-full" />

                    <div className="mt-3 space-y-2">
                      <div ref={timelineRef} className="overflow-x-auto rounded-2xl border border-white/10 bg-black/70 p-2">
                        <div className="relative h-16 min-w-65">
                          <div className="absolute inset-0 flex items-center">
                            <div className="flex min-w-full items-center gap-1">
                              {Array.from({ length: Math.max(1, Math.ceil(maxTrimDuration)) }, (_, index) => {
                                const isSelected = index >= Math.floor(audioTrimStart) && index < Math.ceil(audioTrimEnd);
                                return (
                                  <div
                                    key={index}
                                    className={`h-8 flex-1 rounded-sm ${isSelected ? "bg-[#D4AF37]" : "bg-white/10"}`}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="absolute inset-y-0 left-0 right-0">
                            <div
                              className="absolute inset-y-0 rounded-full border border-[#E8C96F]/60 bg-[#D4AF37]/25"
                              style={{
                                left: `${(audioTrimStart / maxTrimDuration) * 100}%`,
                                width: `${((audioTrimEnd - audioTrimStart) / maxTrimDuration) * 100}%`,
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize rounded-full border border-[#F7E7B2] bg-[#D4AF37]"
                              style={{ left: `${(audioTrimStart / maxTrimDuration) * 100}%` }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setActiveTrimHandle("start");
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-3 -translate-x-1/2 cursor-ew-resize rounded-full border border-[#F7E7B2] bg-[#D4AF37]"
                              style={{ left: `${(audioTrimEnd / maxTrimDuration) * 100}%` }}
                              onPointerDown={(event) => {
                                event.preventDefault();
                                setActiveTrimHandle("end");
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-white/70">
                        <span>{audioTrimStart.toFixed(1)}s</span>
                        <span>{audioTrimEnd.toFixed(1)}s</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleApplyAudioTrim}
                        className="w-full rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/15 px-3 py-2 text-sm font-semibold text-[#F7E7B2]"
                      >
                        Apply trim
                      </button>
                    </div>
                  </div>
                ) : null}

                {audioSelectionError ? (
                  <p className="text-sm text-amber-400">{audioSelectionError}</p>
                ) : null}

                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#E8C96F]/70">
                    Story Duration
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {[2, 4, 8, 12, 24].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setStoryDuration(hours)}
                        className={`rounded-xl border px-2 py-2 text-sm font-semibold transition ${storyDuration === hours
                          ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#F7E7B2]'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center gap-2 pt-2">
                  {storyVoice ? (
                    <div className="w-full rounded-2xl border border-white/10 bg-black/40 p-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[#E8C96F]/70">Audio attached</div>
                      <audio controls src={storyVoice} className="mt-1 h-8 w-full" />
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isVibesPro) return;
                        if (isRecordingVoice && mediaRecorderRef.current) {
                          mediaRecorderRef.current.stop();
                          setIsRecordingVoice(false);
                          return;
                        }
                        setAudioChoiceOpen(true);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                    >
                      🎙 {isRecordingVoice ? "Stop Recording" : "Add Audio"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateStory}
                      disabled={storyCreating}
                      className="min-w-36 rounded-2xl bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {storyCreating ? "Posting..." : "Share Story"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl space-y-4">
              <div className="w-full aspect-square overflow-hidden rounded-xl bg-slate-100">
                {selectedImage ? (
                  <img src={selectedImage} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-linear-to-br from-sky-500 via-cyan-500 to-blue-500 overflow-y-auto p-4 flex items-center justify-center text-white font-semibold text-center">
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
                className="w-full max-h-52 overflow-y-auto text-sm border border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-slate-400 focus:border-sky-300 transition-colors"
                rows={2}
              />

              <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    showStoryNotice("Coming Soon");
                  }}
                  className="bg-sky-50 text-sky-600 py-2.5 rounded-xl hover:bg-sky-100 transition-colors"
                >
                  🎵 {storyMusic ? "Change Audio" : "Add Music"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isVibesPro) {
                      showStoryNotice("Coming Soon");
                      return;
                    }
                    if (isRecordingVoice && mediaRecorderRef.current) {
                      mediaRecorderRef.current.stop();
                      setIsRecordingVoice(false);
                      return;
                    }
                    setAudioChoiceOpen(true);
                  }}
                  className="py-2.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                >
                  🎙 {isRecordingVoice ? "Stop Recording" : "Add Audio"}
                </button>
              </div>

              {storyCreateError ? (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
                  {storyCreateError}
                </p>
              ) : null}

              {storyMusic && <p className="text-[11px] text-sky-600 font-medium truncate px-1">Selected: {storyMusic}</p>}
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
                          ? "bg-sky-500 border-sky-500 text-white shadow-xs"
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
                    <div className="h-full rounded-full bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 transition-all duration-200"
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
                  className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-sky-500 via-cyan-500 to-blue-500 text-white shadow-md shadow-sky-200 active:scale-95 transition-transform"
                  disabled={storyCreating}
                >
                  {storyCreating ? "Working..." : "Post Story 🚀"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (!shouldFocusOnPost) return;

    const handlePopState = () => {
      navigate('/notifications');
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [navigate, shouldFocusOnPost]);

  if (shouldFocusOnPost) {
    return focusedPostContent;
  }

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