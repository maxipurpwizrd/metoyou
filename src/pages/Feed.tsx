import Navbar from "../components/Navbar";
import { useState, useEffect, useRef } from "react";
import { getProfile } from "../utils/profileStorage";

import CreatePost from "../components/CreatePost";
import PostCard from "../components/PostCard";

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

type Post = {
  id: string | number;
  author: User;
  authorId?: string;
  time: string;
  text: string;
  image?: string;
  comments?: Comment[];
  likes: number;
  liked?: boolean;
  highlighted?: boolean;
};

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

  const [selectedStory, setSelectedStory] =
    useState<Story | null>(null);

  const [selectedPostId, setSelectedPostId] =
    useState<string | number | null>(null);

  const [savedPosts, setSavedPosts] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-saved-posts");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [mutedUsers, setMutedUsers] = useState<string[]>(() => {
    const saved = localStorage.getItem("metoyou-muted-users");
    return saved ? (JSON.parse(saved) as string[]) : [];
  });

  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  const [storyEditorOpen, setStoryEditorOpen] =
    useState<boolean>(false);

  const [storyText, setStoryText] =
    useState<string>("");

  const [storyDuration, setStoryDuration] =
    useState<number>(24);
  const [storyMusic, setStoryMusic] =
    useState<string | undefined>(undefined);
  const [storyVoice, setStoryVoice] =
    useState<string | undefined>(undefined);

  const [isRecording, setIsRecording] =
    useState<boolean>(false);

  const [currentTime, setCurrentTime] =
    useState<number>(() => Date.now());

  const [userReactions, setUserReactions] =
    useState<{ [storyId: number]: string | null }>({});

  const [posts, setPosts] = useState<Post[]>(() => {
    const savedPosts = localStorage.getItem(
      "metoyou-posts"
    );

    if (savedPosts) {
      try {
        const parsed = JSON.parse(savedPosts) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.map((post, index) => {
            const safeComments = Array.isArray(post.comments)
              ? post.comments.map((comment: unknown) => {
                  const commentData = comment as {
                    id?: number;
                    user?: string | { id: string; username: string };
                    text?: string;
                    voice?: string;
                    likes?: number;
                  };

                  return {
                    id:
                      commentData.id ??
                      Date.now() + Math.random(),
                    user:
                      typeof commentData.user === "string"
                        ? {
                            id: `user_${commentData.user}`,
                            username: commentData.user,
                          }
                        : commentData.user ?? {
                            id: "user_unknown",
                            username: "Unknown",
                          },
                    text: commentData.text,
                    voice: commentData.voice,
                    likes: commentData.likes ?? 0,
                  };
                })
              : [];

              const resolvedAuthor =
                post.author ?? {
                  id: `user_${index + 100}`,
                  username: post.name || "Unknown",
                };

              return {
                id: post.id ?? `post_saved_${index}`,
                author: resolvedAuthor,
                authorId: post.authorId ?? resolvedAuthor.id,
                time: post.time ?? "Just now",
                text: post.text ?? "",
                image: post.image,
                comments: safeComments,
                likes: post.likes ?? 0,
                liked: Boolean(post.liked),
                highlighted: Boolean(post.highlighted),
              };
          });
        }
      } catch {
        // Ignore invalid saved data and use defaults.
      }
    }

    return [
      {
        id: "post_001",
        author: { id: "user_002", username: "Jessica" },
        authorId: "user_002",
        time: "2h ago",
        text: "Catchin' sunsets! 🌅 #VibesOnPoint",
        comments: [],
        likes: 24,
        liked: false,
      },
      {
        id: "post_002",
        author: { id: "user_003", username: "Mike" },
        authorId: "user_003",
        time: "5h ago",
        text: "Lazy day with this lil' cutie 😺 #Chillin'",
        comments: [],
        likes: 18,
        liked: false,
      },
      {
        id: "post_003",
        author: { id: "user_004", username: "Sarah" },
        authorId: "user_004",
        time: "1d ago",
        text: "Just crushed my workout! Feelin' lit! 💪 #Goals",
        comments: [],
        likes: 42,
        liked: false,
      },
    ];
  });

  const [stories, setStories] = useState<Story[]>(() => {
  const savedStories =
    localStorage.getItem("metoyou-stories");

  if (savedStories) {
    return JSON.parse(savedStories);
  }

  return [
    {
      id: 1,
      name: "Jay",
      text: "🔥",
      duration: "24h",
      expiresAt:
        Date.now() +
        24 * 60 * 60 * 1000,
    },
    {
      id: 2,
      name: "Mike",
      text: "😎",
      duration: "24h",
      expiresAt:
        Date.now() +
        24 * 60 * 60 * 1000,
    },
    {
      id: 3,
      name: "Sarah",
      text: "❤️",
      duration: "24h",
      expiresAt:
        Date.now() +
        24 * 60 * 60 * 1000,
    },
  ];
});


  useEffect(() => {
    localStorage.setItem(
      "metoyou-posts",
      JSON.stringify(posts)
    );
  }, [posts]);

  useEffect(() => {
    localStorage.setItem(
      "metoyou-saved-posts",
      JSON.stringify(savedPosts)
    );
  }, [savedPosts]);

  useEffect(() => {
    localStorage.setItem(
      "metoyou-muted-users",
      JSON.stringify(mutedUsers)
    );
  }, [mutedUsers]);

  useEffect(() => {
    localStorage.setItem(
      "metoyou-stories",
      JSON.stringify(stories)
    );
  }, [stories]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStories((prevStories) =>
        prevStories.filter(
          (story) =>
            story.expiresAt > Date.now()
        )
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
  }, []);
  const handlePost = (
    text: string,
    image?: string
  ) => {
    const profile = getProfile();
    setPosts((prevPosts) => [
      {
        id: Date.now(),
        author: { id: profile.id, username: profile.username },
        time: "Just now",
        likes: 0,
        liked: false,
        highlighted: false,
        text,
        image,
        comments: [],
      },
      ...prevPosts,
    ]);
  };

    const handleStoryClick = () => {
      fileInputRef.current?.click();
    };

    const handleStoryImage = (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
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
          expiresAt:
            Date.now() +
            storyDuration * 60 * 60 * 1000,
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
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 pt-32 pb-10">

        <CreatePost onPost={handlePost} />

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

        {/* Stories */}
        <div className="flex gap-3 overflow-x-auto pb-4 mb-6">

          {/* Add Story */}
          <button
            type="button"
            onClick={handleStoryClick}
            className="min-w-33.75 h-47.5 shrink-0 bg-white border-2 border-dashed border-pink-300 text-pink-500 shadow-lg flex flex-col items-center justify-center hover:scale-105 transition"
            style={{
              borderRadius:
                "50% 50% 28% 28% / 18% 18% 70% 70%",
            }}
          >
            <div className="text-5xl font-bold mb-3">
              +
            </div>

            <div>
              <p className="font-bold text-sm">Your Story</p>
            </div>
          </button>

          {stories.map((story) => (
            <div
              key={story.id}
              onClick={() =>
                setSelectedStory(story)
              }
              className="min-w-33.75 h-47.5 shrink-0 relative overflow-hidden shadow-xl text-white cursor-pointer hover:scale-105 transition"
              style={{
                borderRadius:
                  "50% 50% 28% 28% / 18% 18% 70% 70%",
              }}
            >
              {story.image ? (
                <img
                  src={story.image}
                  alt="story"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-5xl">
                  {story.text}
                </div>
              )}

              <div className="absolute inset-0 bg-black/20"></div>

              <div className="absolute bottom-3 left-0 right-0 text-center px-2">
                <p className="font-bold text-sm">
                  {story.name}
                </p>

                <p className="text-xs opacity-90">
                  ⏳ {getTimeLeft(story.expiresAt)}
                </p>

                {story.image && story.text && (
                  <p className="text-xs truncate">
                    {story.text}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Story Viewer */}
        {selectedStory && (
          <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">

            <button
              type="button"
              onClick={() =>
                setSelectedStory(null)
              }
              className="absolute top-5 right-5 text-white text-4xl z-50"
            >
              ×
            </button>

            <div className="w-full max-w-md h-[90vh] rounded-3xl overflow-hidden relative">

              {/* Progress Bar */}
              {selectedStory && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/20 z-50">
                  <div
                    className="h-full bg-white transition-all duration-1000 ease-linear"
                    style={{
                      width: `${Math.max(0, ((selectedStory.expiresAt - currentTime) / (selectedStory.expiresAt - (selectedStory.expiresAt - (parseInt(selectedStory.duration) * 60 * 60 * 1000)))) * 100)}%`,
                    }}
                  ></div>
                </div>
              )}

              {selectedStory.image ? (
                <img
                  src={selectedStory.image}
                  alt="story"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center text-8xl text-white">
                  {selectedStory.text}
                </div>
              )}

              <div className="absolute inset-0 bg-black/20"></div>

              <div className="absolute bottom-6 left-0 right-0 text-center text-white px-4">
                <p className="text-sm opacity-90 mb-2">
                  ⏳ {getTimeLeft(selectedStory.expiresAt)}
                </p>

                {selectedStory.music && (
                  <p className="text-xs mb-2 opacity-90">🎵 {selectedStory.music}</p>
                )}

                {selectedStory.voice && (
                  <div className="mb-3">
                    <audio controls src={selectedStory.voice} className="w-full h-8" />
                  </div>
                )}

                <div>
  <h2 className="font-bold text-2xl">
    {selectedStory.name}
  </h2>

  <p className="text-sm opacity-90">
    {selectedStory.duration}
  </p>
</div>

                {selectedStory.text && (
                  <p className="mt-2 text-lg">
                    {selectedStory.text}
                  </p>
                )}

                <div className="mt-4 flex gap-2 justify-center">
                  {["❤️", "😂", "🔥", "😮", "👏"].map((emoji) => {
                    const count = selectedStory.reactions?.[emoji]?.length || 0;
                    const isUserReacted = userReactions[selectedStory.id] === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(selectedStory.id, emoji)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          isUserReacted
                            ? "bg-white/30 scale-110"
                            : "bg-white/10 hover:bg-white/20"
                        }`}
                      >
                        {emoji} {count > 0 ? count : ""}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* (old duration modal removed) */}

        {/* Story Editor Modal */}
        {storyEditorOpen && selectedImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => {setStoryEditorOpen(false); setSelectedImage(null); setStoryText(""); setStoryDuration(24); setStoryMusic(undefined); setStoryVoice(undefined);}}></div>

            <div className="relative w-85 bg-white rounded-2xl p-5 shadow-2xl">
              <div className="w-full h-48 mb-4 overflow-hidden rounded-xl">
                <img src={selectedImage} alt="preview" className="w-full h-full object-cover" />
              </div>

              <h3 className="text-center font-bold text-lg mb-2">Create Story</h3>

              <textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Add story text..."
                className="w-full border rounded-2xl px-4 py-3 mb-4 outline-none"
              />

              <div className="flex gap-2 mb-2">
                <button type="button" className="flex-1 py-2 rounded-2xl bg-slate-100">📝 Add Text</button>
                <button
                  type="button"
                  onClick={() => musicInputRef.current?.click()}
                  className="bg-purple-100 py-3 rounded-2xl font-semibold"
                >
                  🎵 Add Music
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isRecording) {
                      stopRecording();
                    } else {
                      startRecording();
                    }
                  }}
                  className="bg-blue-100 py-3 rounded-2xl font-semibold"
                >
                  {isRecording ? "⏹ Stop Recording" : "🎙 Record Voice"}
                </button>
              </div>

              {storyMusic && (
                <p className="text-sm mb-3">🎵 {storyMusic}</p>
              )}

              {storyVoice && (
                <audio controls src={storyVoice} className="mb-3 w-full" />
              )}

              <div className="flex items-center gap-2 mb-4">
                {[2,4,8,12,24].map((h) => (
                  <button
                    key={h}
                    onClick={() => setStoryDuration(h)}
                    className={`px-3 py-2 rounded-2xl border ${storyDuration===h ? "bg-pink-500 text-white" : "bg-white"}`}
                  >
                    {h}h
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
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
                  className="flex-1 py-3 rounded-2xl bg-slate-200 font-bold"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleCreateStory();
                  }}
                  className="flex-1 py-3 rounded-2xl bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-bold"
                >
                  Post Story 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Posts */}
        <div
          onClick={() => {
            if (selectedPostId !== null) {
              setSelectedPostId(null);
            }
          }}
          onWheel={() => setSelectedPostId(null)}
          onTouchMove={() => setSelectedPostId(null)}
          className={selectedPostId !== null ? "relative z-10" : ""}
        >
          {selectedPostId !== null && (
            <div className="fixed inset-0 bg-black/0 z-0 pointer-events-none"></div>
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
                  className={`transition-all duration-200 ${
                    isSelected
                      ? "scale-105 z-20"
                      : selectedPostId !== null
                      ? "blur-sm opacity-40 scale-95 pointer-events-none"
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
                    comments={post.comments}
                    likes={post.likes}
                    liked={Boolean(post.liked)}
                    isSelected={isSelected}
                    onToggleLike={() => {
                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                likes: p.liked
                                  ? Math.max(p.likes - 1, 0)
                                  : p.likes + 1,
                                liked: !p.liked,
                              }
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
                          author: {
                            id: "user_001",
                            username: "Maxi",
                          },
                          time: "Just now",
                          highlighted: false,
                        },
                        ...prev,
                      ]);
                    }}
                    onDeletePost={() => {
                      setPosts((prev) => prev.filter((p) => p.id !== post.id));
                      if (selectedPostId === post.id) setSelectedPostId(null);
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
                    onSavePost={() => {
                      setSavedPosts((prev) =>
                        prev.includes(String(post.id))
                          ? prev
                          : [...prev, String(post.id)]
                      );

                      alert("Post saved!");
                    }}
                    onHighlight={() => {
                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                highlighted: !p.highlighted,
                              }
                            : p
                        )
                      );
                    }}
                    highlighted={Boolean(post.highlighted)}
                    onMuteUser={() => {
                      setMutedUsers((prev) =>
                        prev.includes(post.author.id)
                          ? prev
                          : [...prev, post.author.id]
                      );
                      if (selectedPostId === post.id) {
                        setSelectedPostId(null);
                      }
                      alert("User muted");
                    }}
                    onAddComment={(comment) => {
                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                comments: [
                                  ...(p.comments || []),
                                  {
                                    user: {
                                      id: "user_001",
                                      username: "Maxi",
                                    },
                                    likes: 0,
                                    ...comment,
                                  },
                                ],
                              }
                            : p
                        )
                      );
                    }}
                    onDeleteComment={(commentId) => {
                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                comments:
                                  p.comments?.filter(
                                    (c) => c.id !== commentId
                                  ) || [],
                              }
                            : p
                        )
                      );
                    }}
                    onEditComment={(
                      commentId,
                      newText
                    ) => {
                      setPosts((prevPosts) =>
                        prevPosts.map((p) =>
                          p.id === post.id
                            ? {
                                ...p,
                                comments:
                                  p.comments?.map((c) =>
                                    c.id === commentId
                                      ? {
                                          ...c,
                                          text: newText,
                                        }
                                      : c
                                  ) || [],
                              }
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
                                comments:
                                  p.comments?.map((c) =>
                                    c.id === commentId
                                      ? {
                                          ...c,
                                          likes: c.likes + 1,
                                        }
                                      : c
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
    </div>
  );
}