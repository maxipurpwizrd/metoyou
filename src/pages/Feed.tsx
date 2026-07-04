import Navbar from "../components/Navbar";
import { useState, useEffect, useRef } from "react";
import { useFeed, type Post as FeedPost } from "../contexts/FeedContext";
import { getProfile } from "../utils/profileStorage";

import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";
import { savePostToSupabase, deletePostFromSupabase, uploadAudioToSupabase } from "../lib/postApi";
import { addComment, editComment, deleteComment } from "../lib/commentApi";
import { likePost, unlikePost, hasUserLiked, getPostLikes } from "../lib/likeApi";

type Post = FeedPost ;

type Story = {
  id: number;
  name: string;
  text?: string;
  image?: string;
  music?: string;
  voice?: string;
  duration: string;
  expiresAt: number;
  reactions?: { [emoji: string]: string[] };
};

export default function Feed() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [selectedStory, setSelectedStory] = useState<Story | null>(null);


  const [savedPosts, setSavedPosts] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-posts");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [mutedUsers, setMutedUsers] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-muted-users");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [storyEditorOpen, setStoryEditorOpen] = useState<boolean>(false);
  const [storyText, setStoryText] = useState<string>(" ");
  const [storyDuration, setStoryDuration] = useState<number>(24);
  const [storyMusic, setStoryMusic] = useState<string | undefined>(undefined);
  const [storyVoice, setStoryVoice] = useState<string | undefined>(undefined);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());
  const [userReactions, setUserReactions] = useState<{ [storyId: number]: string | null }>({});
  const { posts, setPosts, savedScrollY, setSavedScrollY, selectedPostId, setSelectedPostId } = useFeed();

  const [stories, setStories] = useState<Story[]>(() => {
    const savedStories = localStorage.getItem("metoyou-stories");
    if (savedStories) return JSON.parse(savedStories);

    return [
      {
        id: 1,
        name: "Jay",
        text: "🔥",
        duration: "24h",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      {
        id: 2,
        name: "Mike",
        text: "😎",
        duration: "24h",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
      {
        id: 3,
        name: "Sarah",
        text: "❤️",
        duration: "24h",
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    ];
  });

  useEffect(() => {
    localStorage.setItem("metoyou-saved-posts", JSON.stringify(savedPosts));
  }, [savedPosts]);

  useEffect(() => {
    localStorage.setItem("metoyou-muted-users", JSON.stringify(mutedUsers));
  }, [mutedUsers]);

  useEffect(() => {
    localStorage.setItem("metoyou-stories", JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    const handleScroll = () => {
      setSelectedPostId(null);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [setSelectedPostId]);

  const updatePostById = (postId: string | number, patch: Partial<Post>) => {
    setPosts((prev) => prev.map((post) => (post.id === postId ? { ...post, ...patch } : post)));
  };

  const persistPost = async (
    postId: string | number,
    payload: { text?: string; image?: string; video?: string; audio?: string },
    onProgress?: (percent: number) => void
  ) => {
    const profile = getProfile();
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
      const audioUrl = payload.audio
        ? await uploadAudioToSupabase(payload.audio, profile.id)
        : undefined;

      const saved = await savePostToSupabase({
        author_id: profile.id,
        text: payload.text ?? null,
        image_url: payload.image ?? null,
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
        image: saved.image_url ?? payload.image ?? undefined,
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

      window.setTimeout(() => {
        updatePostById(postId, {
          uploadState: undefined,
          uploadProgress: undefined,
        });
      }, 2000);

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
    const profile = getProfile();
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
    fileInputRef.current?.click();
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

  const handleCreateStory = () => {
    if (!selectedImage) return;

    setStories((prevStories) => [
      {
        id: Date.now(),
        name: "Maxi",
        text: storyText,
        music: storyMusic,
        voice: storyVoice,
        image: selectedImage,
        duration: `${storyDuration}h`,
        expiresAt: Date.now() + storyDuration * 60 * 60 * 1000,
      },
      ...prevStories,
    ]);

    setStoryEditorOpen(false);
    setSelectedImage(null);
    setStoryText("");
    setStoryDuration(24);
    setStoryMusic(undefined);
    setStoryVoice(undefined);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setStoryVoice(audioUrl);
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone permission denied.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const getTimeLeft = (expiresAt: number) => {
    const diff = expiresAt - currentTime;
    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const handleReaction = (storyId: number, emoji: string) => {
    setStories((prevStories) =>
      prevStories.map((story) => {
        if (story.id !== storyId) return story;

        const currentReaction = userReactions[storyId];
        const isToggling = currentReaction === emoji;
        const newReactions = story.reactions ? { ...story.reactions } : {};

        if (currentReaction) {
          if (!newReactions[currentReaction]) newReactions[currentReaction] = [];
          newReactions[currentReaction] = newReactions[currentReaction].filter(
            (user) => user !== "You"
          );
          if (newReactions[currentReaction].length === 0) {
            delete newReactions[currentReaction];
          }
        }

        if (!isToggling) {
          if (!newReactions[emoji]) newReactions[emoji] = [];
          newReactions[emoji] = [...newReactions[emoji], "You"];
        }

        setUserReactions((prev) => ({
          ...prev,
          [storyId]: isToggling ? null : emoji,
        }));

        return { ...story, reactions: newReactions };
      })
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 px-4 sm:px-6">
      {/* Dynamic Floating Navbar Container */}
      <Navbar />

      <div className="max-w-md mx-auto pt-28 pb-24 space-y-5">
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
            className="min-w-[82px] h-[120px] md:min-w-[110px] md:h-[160px] shrink-0 bg-white/80 backdrop-blur-xs border-2 border-dashed border-pink-300 text-pink-500 shadow-md flex flex-col items-center justify-center hover:scale-[1.02] active:scale-95 transition-all snap-start"
            style={{ borderRadius: "50% 50% 28% 28% / 18% 18% 70% 70%" }}
          >
            <span className="text-2xl md:text-3xl font-light mb-0.5 md:mb-1">+</span>
            <span className="font-bold text-[10px] md:text-xs tracking-wide">Your Story</span>
          </button>

          {/* Render Active Stories */}
          {stories.map((story) => (
            <div
              key={story.id}
              onClick={() => setSelectedStory(story)}
              className="min-w-[82px] h-[120px] md:min-w-[110px] md:h-[160px] shrink-0 relative overflow-hidden shadow-md text-white cursor-pointer hover:scale-[1.02] transition-transform snap-start"
              style={{ borderRadius: "50% 50% 28% 28% / 18% 18% 70% 70%" }}
            >
              {story.image ? (
                <img
                  src={story.image}
                  alt="story"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-2xl md:text-3xl">
                  {story.text}
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10"></div>

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
          onWheel={() => setSelectedPostId(null)}
          onTouchMove={() => setSelectedPostId(null)}
          className={`space-y-4 transition-all duration-300 ${selectedPostId !== null ? "relative z-10" : ""}`}
        >
          {selectedPostId !== null && (
            <div className="fixed inset-0 bg-black/5 z-0 pointer-events-none backdrop-blur-xs"></div>
          )}

          {posts
            .filter((post) => !mutedUsers.includes(post.author.id))
            .map((post) => {
              const isSelected = selectedPostId === post.id;

              return (
                <div
                  key={String(post.id)}
                  onClick={(e) => {
                    e.stopPropagation();
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
                      const profile = getProfile();
                      if (!profile) return;
                      const userId = profile.id;

                      const currentlyLiked = await hasUserLiked(String(post.id), userId);
                      if (currentlyLiked) {
                        await unlikePost(String(post.id), userId);
                      } else {
                        await likePost(String(post.id), userId);
                      }

                      const likesData = await getPostLikes(String(post.id));
                      const likesCount = (likesData || []).length;
                      const userLikedNow = likesData.some((l) => l.user_id === userId);

                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? { ...p, likes: likesCount, likes_count: likesCount, liked: Boolean(userLikedNow) }
                            : p
                        )
                      );
                    }}
                    onSelectPost={() => setSelectedPostId(post.id)}
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
                      const profile = getProfile();
                      if (!profile) return;

                      const added = await addComment(String(post.id), profile.id, comment.text);
                      if (!added) return;

                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                comments: [
                                  ...(p.comments || []),
                                  {
                                    id: added.id,
                                    user: { id: added.author_id, username: added.profiles?.username ?? added.author_id },
                                    text: added.text ?? "",
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
              );
            })}
        </div>
      </div>

      {/* Story Fullscreen Viewer Modal */}
      {selectedStory && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setSelectedStory(null)}
            className="absolute top-5 right-5 text-white/70 hover:text-white text-3xl font-light transition-colors z-50"
          >
            ✕
          </button>

          <div className="w-full max-w-sm h-[85vh] rounded-2xl overflow-hidden relative shadow-2xl bg-slate-900">
            {/* Contextual Story Progress Ticker */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-50">
              <div
                className="h-full bg-white transition-all duration-1000 ease-linear"
                style={{
                  width: `${Math.max(0, ((selectedStory.expiresAt - currentTime) / (selectedStory.expiresAt - (selectedStory.expiresAt - (parseInt(selectedStory.duration) * 60 * 60 * 1000)))) * 100)}%`,
                }}
              ></div>
            </div>

            {selectedStory.image ? (
              <div className="flex items-center justify-center w-full h-full bg-slate-900">
                <img
                  src={selectedStory.image}
                  alt="story content"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-full bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-6xl text-white">
                {selectedStory.text}
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40"></div>

            <div className="absolute bottom-6 left-0 right-0 text-center text-white px-4 space-y-3">
              <p className="text-xs text-white/70">⏳ {getTimeLeft(selectedStory.expiresAt)}</p>

              {selectedStory.music && (
                <p className="text-xs bg-black/30 inline-block px-3 py-1 rounded-full text-purple-200">🎵 {selectedStory.music}</p>
              )}

              {selectedStory.voice && (
                <div className="mx-auto max-w-xs">
                  <audio controls src={selectedStory.voice} className="w-full h-6 opacity-80" />
                </div>
              )}

              <div>
                <h2 className="font-bold text-xl tracking-tight">{selectedStory.name}</h2>
                <p className="text-xs text-white/60 mt-0.5">{selectedStory.duration}</p>
              </div>

              {selectedStory.text && (
                <p className="text-sm font-medium px-4 text-white/90">{selectedStory.text}</p>
              )}

              {/* Reaction Pill Container */}
              <div className="pt-2 flex gap-1.5 justify-center">
                {["❤️", "😂", "🔥", "😮", "👏"].map((emoji) => {
                  const count = selectedStory.reactions?.[emoji]?.length || 0;
                  const isUserReacted = userReactions[selectedStory.id] === emoji;
                  return (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(selectedStory.id, emoji)}
                      className={`px-2.5 py-1 rounded-full text-xs transition-all ${
                        isUserReacted
                          ? "bg-white text-slate-900 scale-105 font-bold shadow-md"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {emoji} <span className="text-[10px] opacity-90">{count > 0 ? count : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Builder/Editor Overlay */}
      {storyEditorOpen && selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => {setStoryEditorOpen(false); setSelectedImage(null); setStoryText(""); setStoryDuration(24); setStoryMusic(undefined); setStoryVoice(undefined);}}></div>

          <div className="relative w-full max-w-xs bg-white rounded-2xl p-4 shadow-2xl space-y-4">
            <div className="w-full h-40 overflow-hidden rounded-xl bg-slate-100">
              <img src={selectedImage} alt="preview" className="w-full h-full object-cover" />
            </div>

            <h3 className="text-center font-bold text-base text-slate-800">Create Story</h3>

            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder="Drop a vibe text onto your story..."
              className="w-full text-sm border border-slate-100 bg-slate-50/50 rounded-xl px-3 py-2.5 outline-none resize-none placeholder:text-slate-400 focus:border-pink-300 transition-colors"
              rows={2}
            />

            <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={() => musicInputRef.current?.click()}
                className="bg-purple-50 text-purple-600 py-2.5 rounded-xl hover:bg-purple-100 transition-colors"
              >
                🎵 {storyMusic ? "Change Audio" : "Add Music"}
              </button>
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`py-2.5 rounded-xl transition-colors ${isRecording ? "bg-red-500 text-white animate-pulse" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
              >
                {isRecording ? "⏹ Stop Record" : "🎙 Record Voice"}
              </button>
            </div>

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

            <div className="flex gap-2 pt-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setStoryEditorOpen(false);
                  setSelectedImage(null);
                  setStoryText("");
                  setStoryDuration(24);
                  setStoryMusic(undefined);
                  setStoryVoice(undefined);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateStory}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white shadow-md shadow-purple-200 active:scale-95 transition-transform"
              >
                Post Story 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}