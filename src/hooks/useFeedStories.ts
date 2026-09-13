import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStoriesFromSupabase, subscribeToStories, deleteStoryFromSupabase, type StoryRecord } from "../lib/storyApi";

export function mapStoryRecord(story: StoryRecord) {
  return {
    id: story.id,
    name: story.author_username,
    text: story.text ?? undefined,
    image: story.image_url ?? undefined,
    imageOriginal: story.image_original_url ?? undefined,
    voice: story.voice_url ?? undefined,
    durationHours: story.duration_hours,
    expiresAt: new Date(story.expires_at).getTime(),
    reactions: story.reactions as Record<string, string[]> | undefined,
    profilePic: story.author_profile_pic ?? undefined,
    storyType: story.story_type,
    authorId: story.author_id,
    createdAt: story.created_at,
  };
}

export function useFeedStories() {
  const [stories, setStories] = useState<any[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [selectedStory, setSelectedStory] = useState<any | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyCreateProgress, setStoryCreateProgress] = useState(0);
  const [storyCreateStatus, setStoryCreateStatus] = useState<string | null>(null);
  const [storyCreateError, setStoryCreateError] = useState<string | null>(null);
  const [savedStories, setSavedStories] = useState<string[]>(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem("metoyou-saved-stories") : null;
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const autoCloseTimeoutRef = useRef<number | null>(null);
  const suppressAutoCloseRef = useRef(false);

  useEffect(() => {
    let isActive = true;
    const hydrate = async () => {
      setStoriesLoading(true);
      try {
        const remoteStories = await fetchStoriesFromSupabase();
        if (!isActive) return;
        setStories(remoteStories.map(mapStoryRecord));
      } catch (e) {
        console.error('Failed to load stories', e);
      } finally {
        if (isActive) setStoriesLoading(false);
      }
    };
    void hydrate();

    const channel = subscribeToStories((remote) => {
      if (!isActive) return;
      setStories(remote.map(mapStoryRecord));
    });

    return () => {
      isActive = false;
      try { channel.unsubscribe(); } catch {};
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (suppressAutoCloseRef.current) return;
      setSelectedStory(null);
    };

    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const openStoryAtIndex = useCallback((index: number) => {
    const story = stories[index];
    if (!story) return;
    setSelectedStory(story);
    setSelectedStoryIndex(index);
    setStoryProgress(0);
    setStories((prev) => prev.map((s) => (s.id === story.id ? { ...s, viewedAt: Date.now() } : s)));
  }, [stories]);

  const goToNextStory = useCallback(() => {
    if (selectedStoryIndex === null) return;
    const next = (selectedStoryIndex + 1) % stories.length;
    openStoryAtIndex(next);
  }, [selectedStoryIndex, stories.length, openStoryAtIndex]);

  const goToPreviousStory = useCallback(() => {
    if (selectedStoryIndex === null) return;
    const prev = (selectedStoryIndex - 1 + stories.length) % stories.length;
    openStoryAtIndex(prev);
  }, [selectedStoryIndex, stories.length, openStoryAtIndex]);

  const handleShareStory = useCallback((story?: any) => {
    const target = story ?? selectedStory;
    if (!target) return;
    const shareText = story.text ? `${story.name} says: ${story.text}` : `${story.name} shared a story on MeToYou.`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      navigator.share({ title: `${story.name}'s story`, text: shareText, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${shareText} ${shareUrl}`).catch(() => {});
      window.alert("Story link copied to clipboard.");
    }
  }, []);

  const handleSaveStory = useCallback((story?: any) => {
    const target = story ?? selectedStory;
    if (!target) return;
    setSavedStories((prev) => {
      if (prev.includes(target.id)) return prev;
      const next = [...prev, target.id];
      try { window.localStorage.setItem("metoyou-saved-stories", JSON.stringify(next)); } catch {}
      return next;
    });
    setStoryMenuOpen(false);
  }, [selectedStory]);

  const handleDeleteStory = useCallback(async (story?: any) => {
    const target = story ?? selectedStory;
    if (!target) return;
    try {
      await deleteStoryFromSupabase(target.id);
      setStories((prev) => prev.filter((s) => s.id !== target.id));
    } catch (e) {
      console.error('Failed to delete story', e);
    }
  }, [selectedStory]);

  const setAutoCloseSuppressed = useCallback((isSuppressed: boolean) => {
    suppressAutoCloseRef.current = isSuppressed;
    if (autoCloseTimeoutRef.current) { window.clearTimeout(autoCloseTimeoutRef.current); autoCloseTimeoutRef.current = null; }
    if (isSuppressed) {
      autoCloseTimeoutRef.current = window.setTimeout(() => { suppressAutoCloseRef.current = false; autoCloseTimeoutRef.current = null; }, 700);
    }
  }, []);

  return {
    stories,
    storiesLoading,
    selectedStory,
    selectedStoryIndex,
    storyProgress,
    setStoryProgress,
    storyMenuOpen,
    setStoryMenuOpen,
    storyCreating,
    setStoryCreating,
    storyCreateProgress,
    setStoryCreateProgress,
    storyCreateStatus,
    setStoryCreateStatus,
    storyCreateError,
    setStoryCreateError,
    savedStories,
    setSavedStories,
    openStoryAtIndex,
    goToNextStory,
    goToPreviousStory,
    handleShareStory,
    handleSaveStory,
    handleDeleteStory,
    setAutoCloseSuppressed,
    setStories,
    setSelectedStory,
    setSelectedStoryIndex,
  };
}
