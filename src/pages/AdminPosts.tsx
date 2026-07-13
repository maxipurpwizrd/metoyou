import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Heart, MessageCircle, Search, Sparkles, User } from "lucide-react";
import PostCard from "../components/PostCard";
import { supabase } from "../lib/supabase";

type AdminPostListItem = {
  id: string;
  authorId: string;
  username: string;
  profilePic: string | null;
  text: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
};

function extractSupabaseStoragePath(url: string) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (match) {
      return `${match[1]}/${decodeURIComponent(match[2])}`;
    }
  } catch {
    // ignore malformed URLs
  }

  const fallbackMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (fallbackMatch) {
    return `${fallbackMatch[1]}/${decodeURIComponent(fallbackMatch[2])}`;
  }

  return null;
}

export default function AdminPosts() {
  const navigate = useNavigate();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminPosts, setAdminPosts] = useState<AdminPostListItem[]>([]);
  const [adminPostsLoading, setAdminPostsLoading] = useState(false);
  const [adminPostsSearch, setAdminPostsSearch] = useState("");
  const [adminPostsError, setAdminPostsError] = useState<string | null>(null);
  const [adminPostToDelete, setAdminPostToDelete] = useState<AdminPostListItem | null>(null);
  const [deletingAdminPostId, setDeletingAdminPostId] = useState<string | null>(null);
  const [selectedAdminPost, setSelectedAdminPost] = useState<AdminPostListItem | null>(null);
  const [markedPostIds, setMarkedPostIds] = useState<string[]>([]);
  const [deleteSuccessMessage, setDeleteSuccessMessage] = useState<string | null>(null);
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false);
  const [deletingSelectedAdminPosts, setDeletingSelectedAdminPosts] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const verifyAdminAccess = async () => {
      setIsCheckingAccess(true);
      setHasAdminAccess(false);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user?.id) {
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (profileError) {
          return;
        }

        setHasAdminAccess(profileData?.is_admin === true);
      } catch {
        if (isMounted) {
          setHasAdminAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAccess(false);
        }
      }
    };

    void verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasAdminAccess) {
      return;
    }

    let isMounted = true;

    const loadAdminPosts = async () => {
      setAdminPostsLoading(true);
      setAdminPostsError(null);

      try {
        const { data, error } = await supabase
          .from("posts")
          .select(
            "id, author_id, text, image_url, video_url, audio_url, likes_count, comments_count, created_at, profiles(username, profile_pic)"
          )
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        const normalizedSearch = adminPostsSearch.trim().toLowerCase();
        const filteredPosts = (data ?? [])
          .map((item: any) => ({
            id: item.id,
            authorId: item.author_id,
            username: item.profiles?.username ?? "Unknown",
            profilePic: item.profiles?.profile_pic ?? null,
            text: item.text ?? null,
            imageUrl: item.image_url ?? null,
            videoUrl: item.video_url ?? null,
            audioUrl: item.audio_url ?? null,
            likesCount: item.likes_count ?? 0,
            commentsCount: item.comments_count ?? 0,
            createdAt: item.created_at,
          }))
          .filter((post) => {
            if (!normalizedSearch) {
              return true;
            }
            const haystack = `${post.text ?? ""} ${post.username ?? ""}`.toLowerCase();
            return haystack.includes(normalizedSearch);
          });

        if (isMounted) {
          setAdminPosts(filteredPosts);
        }
      } catch (error) {
        console.error("loadAdminPosts error", error);
        if (isMounted) {
          setAdminPosts([]);
          setAdminPostsError("Unable to load posts right now.");
        }
      } finally {
        if (isMounted) {
          setAdminPostsLoading(false);
        }
      }
    };

    void loadAdminPosts();

    return () => {
      isMounted = false;
    };
  }, [adminPostsSearch, hasAdminAccess]);

  const toggleMarkedPost = (postId: string) => {
    setMarkedPostIds((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  };

  const renderPostMedia = (post: AdminPostListItem) => {
    if (!post.imageUrl && !post.videoUrl && !post.audioUrl) {
      return null;
    }

    return (
      <div className="mt-4 space-y-3">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt="Admin post media" className="max-h-80 w-full rounded-2xl border border-slate-200 object-cover" />
        ) : null}
        {post.videoUrl ? (
          <video controls playsInline src={post.videoUrl} className="max-h-80 w-full rounded-2xl border border-slate-200 bg-slate-950 object-contain" />
        ) : null}
        {post.audioUrl ? (
          <audio controls src={post.audioUrl} className="w-full" />
        ) : null}
      </div>
    );
  };

  const deleteSingleAdminPost = async (post: AdminPostListItem) => {
    const storageTargets = [post.imageUrl, post.videoUrl, post.audioUrl].filter(Boolean) as string[];
    for (const mediaUrl of storageTargets) {
      try {
        const storagePath = extractSupabaseStoragePath(mediaUrl);
        if (!storagePath) {
          continue;
        }

        const [bucket, ...pathParts] = storagePath.split("/");
        if (!bucket || pathParts.length === 0) {
          continue;
        }

        await supabase.storage.from(bucket).remove([pathParts.join("/")]);
      } catch (storageError) {
        console.error("Failed to delete post storage object", storageError);
      }
    }

    await Promise.allSettled([
      supabase.from("comments").delete().eq("post_id", post.id),
      supabase.from("post_likes").delete().eq("post_id", post.id),
      supabase.from("notifications").delete().eq("post_id", post.id),
    ]);

    const { error: deleteError } = await supabase.from("posts").delete().eq("id", post.id);
    if (deleteError) {
      throw deleteError;
    }
  };

  const handleDeleteAdminPost = async () => {
    if (!adminPostToDelete) {
      return;
    }

    setDeletingAdminPostId(adminPostToDelete.id);
    setAdminPostsError(null);

    try {
      await deleteSingleAdminPost(adminPostToDelete);

      setAdminPosts((prev) => prev.filter((post) => post.id !== adminPostToDelete.id));
      setMarkedPostIds((prev) => prev.filter((id) => id !== adminPostToDelete.id));
      setAdminPostToDelete(null);
      setSelectedAdminPost((current) => (current?.id === adminPostToDelete.id ? null : current));
      setDeleteSuccessMessage("Post deleted successfully.");
      window.setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 1800);
    } catch (error) {
      console.error("handleDeleteAdminPost error", error);
      setAdminPostsError("Failed to delete this post. Please try again.");
      window.alert("Failed to delete this post. Please try again.");
    } finally {
      setDeletingAdminPostId(null);
    }
  };

  const handleDeleteSelectedAdminPosts = async () => {
    if (markedPostIds.length === 0) {
      return;
    }

    const selectedIds = [...markedPostIds];
    setDeletingSelectedAdminPosts(true);
    setAdminPostsError(null);

    try {
      const postsToDelete = adminPosts.filter((post) => selectedIds.includes(post.id));
      for (const post of postsToDelete) {
        await deleteSingleAdminPost(post);
      }

      setAdminPosts((prev) => prev.filter((post) => !selectedIds.includes(post.id)));
      setMarkedPostIds([]);
      setShowDeleteSelectedConfirm(false);
      setSelectedAdminPost((current) => (current && selectedIds.includes(current.id) ? null : current));
      setDeleteSuccessMessage(`Deleted ${postsToDelete.length} selected post${postsToDelete.length === 1 ? "" : "s"}.`);
      window.setTimeout(() => {
        setDeleteSuccessMessage(null);
      }, 1800);
    } catch (error) {
      console.error("handleDeleteSelectedAdminPosts error", error);
      setAdminPostsError("Failed to delete the selected posts. Please try again.");
      window.alert("Failed to delete the selected posts. Please try again.");
    } finally {
      setDeletingSelectedAdminPosts(false);
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="app-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
            <p className="text-lg font-semibold text-slate-900">Checking access…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="app-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <p className="text-lg font-semibold text-slate-900">Sorry, you're not an admin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
          <ArrowLeft className="h-4 w-4" />
          ← Back
        </button>

        <div className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <h1 className="text-2xl font-semibold text-slate-900">Posts</h1>
          </div>

          <div className="mb-4 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Search className="h-4 w-4" />
            <input
              value={adminPostsSearch}
              onChange={(event) => setAdminPostsSearch(event.target.value)}
              placeholder="Search posts or usernames"
              className="w-full bg-transparent outline-none"
            />
          </div>

          {adminPostsError ? <p className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{adminPostsError}</p> : null}

          {adminPostsLoading ? (
            <p className="text-sm text-slate-500">Loading posts…</p>
          ) : adminPosts.length === 0 ? (
            <p className="text-sm text-slate-500">No posts found.</p>
          ) : (
            <div className="space-y-3">
              {adminPosts.map((post) => (
                <div key={post.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                        {post.profilePic ? <img src={post.profilePic} alt={post.username} className="h-full w-full object-cover" /> : post.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/profile/${encodeURIComponent(post.username)}`)}
                            className="font-semibold text-slate-900 transition hover:text-pink-600"
                          >
                            {post.username}
                          </button>
                          <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={markedPostIds.includes(post.id)}
                              onChange={() => toggleMarkedPost(post.id)}
                              className="h-4 w-4 rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                            />
                            Mark to delete
                          </label>
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                          {post.text || "Shared a post"}
                        </div>
                        {renderPostMedia(post)}
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{post.likesCount}</span>
                          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{post.commentsCount}</span>
                          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(post.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setSelectedAdminPost(post)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700">View</button>
                      <button type="button" disabled={deletingAdminPostId === post.id} onClick={() => setAdminPostToDelete(post)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                        {deletingAdminPostId === post.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {markedPostIds.length > 0 ? (
        <div className="fixed bottom-4 right-4 z-40">
          <button
            type="button"
            onClick={() => setShowDeleteSelectedConfirm(true)}
            className="rounded-full bg-rose-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-rose-700"
          >
            Delete Selected Post
          </button>
        </div>
      ) : null}

      {showDeleteSelectedConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-900">Delete selected posts?</p>
            <p className="mt-2 text-sm text-slate-600">This will permanently remove {markedPostIds.length} selected post{markedPostIds.length === 1 ? "" : "s"}.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setShowDeleteSelectedConfirm(false)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteSelectedAdminPosts} disabled={deletingSelectedAdminPosts} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                {deletingSelectedAdminPosts ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminPostToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-900">Delete this post?</p>
            <p className="mt-2 text-sm text-slate-600">This action cannot be undone.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setAdminPostToDelete(null)} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={handleDeleteAdminPost} disabled={deletingAdminPostId === adminPostToDelete.id} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70">
                {deletingAdminPostId === adminPostToDelete.id ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteSuccessMessage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 p-4">
          <div className="flex items-center gap-3 rounded-full border border-pink-200 bg-white/95 px-4 py-3 shadow-xl">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-pink-100 text-pink-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Deleted successfully</p>
              <p className="text-xs text-slate-500">{deleteSuccessMessage}</p>
            </div>
            <Sparkles className="h-4 w-4 text-amber-400" />
          </div>
        </div>
      ) : null}

      {selectedAdminPost ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/60 bg-white p-3 shadow-2xl">
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={() => setSelectedAdminPost(null)} className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">Close</button>
            </div>
            <div className="px-1 sm:px-2">
              <PostCard
                author={{ id: selectedAdminPost.authorId, username: selectedAdminPost.username, avatar: selectedAdminPost.profilePic ?? undefined }}
                postId={selectedAdminPost.id}
                authorId={selectedAdminPost.authorId}
                time={new Date(selectedAdminPost.createdAt).toLocaleString()}
                text={selectedAdminPost.text ?? ""}
                image={selectedAdminPost.imageUrl ?? undefined}
                video={selectedAdminPost.videoUrl ?? undefined}
                audio={selectedAdminPost.audioUrl ?? undefined}
                comments={[]}
                likes={selectedAdminPost.likesCount}
                isSelected
                onClosePost={() => setSelectedAdminPost(null)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
