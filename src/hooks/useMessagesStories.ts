import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { savePostToSupabase } from "../lib/postApi";
import {
  createStoryToSupabase,
  deleteStoryFromSupabase,
  fetchStoriesFromSupabase,
  type StoryRecord,
  type StoryType,
} from "../lib/storyApi";

interface UserProfileLike {
  username?: string | null;
  profilePic?: string | null;
}

interface UseMessagesStoriesOptions {
  currentUserId?: string;
  profile: UserProfileLike | null;
}

export function useMessagesStories({ currentUserId, profile }: UseMessagesStoriesOptions) {
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState<StoryRecord | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyChoiceOpen, setStoryChoiceOpen] = useState(false);
  const [storyEditorOpen, setStoryEditorOpen] = useState(false);
  const [storyMode, setStoryMode] = useState<"text" | "photo" | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storyText, setStoryText] = useState("");
  const [storyDuration, setStoryDuration] = useState<number>(24);
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

  const handleStoryClick = useCallback(() => {
    setStoryChoiceOpen(true);
  }, []);

  const openStoryEditor = useCallback((mode: "text" | "photo") => {
    setStoryMode(mode);
    setStoryChoiceOpen(false);

    if (mode === "photo") {
      return;
    }

    setStoryEditorOpen(true);
    setSelectedImage(null);
    setStoryText("");
    setStoryDuration(24);
    setStoryCreateError(null);
    setStoryCreateProgress(0);
    setStoryCreateStatus(null);
  }, []);

  const handleStoryImage = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
      setStoryEditorOpen(true);
      setStoryText("");
      setStoryDuration(24);
      setStoryCreateError(null);
      setStoryCreateProgress(0);
      setStoryCreateStatus(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCreateStory = useCallback(async () => {
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
        durationHours: storyDuration,
      });

      if (!createdStory) {
        setStoryCreateError("Could not create story right now.");
      } else {
        setStories((prev) => [createdStory, ...prev.filter((story) => story.id !== createdStory.id)]);
        setStoryEditorOpen(false);
        setStoryMode(null);
        setSelectedImage(null);
        setStoryText("");
        setStoryDuration(24);
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
  }, [currentUserId, profile, selectedImage, storyDuration, storyText]);

  const handleCloseStoryEditor = useCallback(() => {
    setStoryEditorOpen(false);
    setStoryMode(null);
    setSelectedImage(null);
    setStoryText("");
    setStoryDuration(24);
    setStoryCreateError(null);
    setStoryCreateProgress(0);
    setStoryCreateStatus(null);
  }, []);

  const openStoryAtIndex = useCallback((index: number) => {
    const story = stories[index];
    if (!story) return;

    setSelectedStory(story);
    setSelectedStoryIndex(index);
    setStoryProgress(0);
  }, [stories]);

  const closeStoryViewer = useCallback(() => {
    setSelectedStory(null);
    setSelectedStoryIndex(null);
    setStoryProgress(0);
    setStoryMenuOpen(false);
  }, []);

  const toggleStoryMenu = useCallback(() => {
    setStoryMenuOpen((open) => !open);
  }, []);

  const handleShareStory = useCallback(async () => {
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
  }, [selectedStory]);

  const handleSaveStory = useCallback(() => {
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
  }, [selectedStory]);

  const handleShareStoryToFeed = useCallback(async () => {
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
  }, [currentUserId, selectedStory]);

  const handleDeleteStory = useCallback(async () => {
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
  }, [closeStoryViewer, currentUserId, selectedStory]);

  const handleReportStory = useCallback(() => {
    setStoryMenuOpen(false);
    window.alert("This story has been reported. Our moderation team will review it shortly.");
  }, []);

  const handleStoryMenuAction = useCallback((action: string) => {
    switch (action) {
      case "delete":
        void handleDeleteStory();
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
  }, [handleDeleteStory, handleReportStory, handleSaveStory, handleShareStory, handleShareStoryToFeed]);

  const loadStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      const fetchedStories = await fetchStoriesFromSupabase();
      setStories(fetchedStories);
    } catch (error) {
      console.error("Failed to load VibesPro stories on Messages page", error);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  return {
    stories,
    setStories,
    storiesLoading,
    setStoriesLoading,
    selectedStoryIndex,
    setSelectedStoryIndex,
    selectedStory,
    setSelectedStory,
    storyProgress,
    setStoryProgress,
    storyChoiceOpen,
    setStoryChoiceOpen,
    storyEditorOpen,
    setStoryEditorOpen,
    storyMode,
    setStoryMode,
    selectedImage,
    setSelectedImage,
    storyText,
    setStoryText,
    storyDuration,
    setStoryDuration,
    storyCreating,
    setStoryCreating,
    storyCreateError,
    setStoryCreateError,
    storyCreateProgress,
    setStoryCreateProgress,
    storyCreateStatus,
    setStoryCreateStatus,
    storyMenuOpen,
    setStoryMenuOpen,
    storyMenuRef,
    savedStories,
    setSavedStories,
    handleStoryClick,
    openStoryEditor,
    handleStoryImage,
    handleCreateStory,
    handleCloseStoryEditor,
    openStoryAtIndex,
    closeStoryViewer,
    toggleStoryMenu,
    handleShareStory,
    handleSaveStory,
    handleShareStoryToFeed,
    handleDeleteStory,
    handleReportStory,
    handleStoryMenuAction,
    loadStories,
  };
}
