import { Link, useNavigate, useParams } from "react-router-dom";
import type { ChangeEvent } from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { getProfile, saveProfile } from "../utils/profileStorage";
import { useProfile } from "../contexts/ProfileContext";
import { fetchProfileFromSupabase, fetchProfileByUsername, upsertProfileToSupabase, uploadProfileImage } from "../lib/profileApi";
import { fetchPostsFromSupabase } from "../lib/postApi";
import { addComment, getComments, editComment, deleteComment } from "../lib/commentApi";
import { likePost, unlikePost, getPostLikes } from "../lib/likeApi";
import { followUser, unfollowUser, getFollowStatus } from "../lib/followApi";
import FollowButton from "../components/social/FollowButton";
import { useAuth } from "../hooks/useAuth";
import type { ProfileData } from "../types/profile";
import { useLanguage } from "../contexts/LanguageContext";
import { normalizeLanguage } from "../lib/i18n";
import ImageViewer from "../components/ImageViewer";
import PostCard from "../components/PostCard";
import VibesProProfilePage from "../components/VibesPro/VibesProProfilePage";
import { Settings2 } from "lucide-react";

type ProfileComment = {
  id: string | number;
  user: { id: string; username: string };
  text?: string;
  voice?: string;
  likes?: number;
};

type ProfilePost = {
  id: string | number;
  author: { id: string; username: string };
  text: string;
  image?: string;
  highlighted?: boolean;
  time?: string;
  likes?: number;
  liked?: boolean;
  comments?: number;
  commentList?: ProfileComment[];
  like_count?: number;
  comment_count?: number;
};


export default function Profile(_props: { embedded?: boolean } = {}) {
  const { setLanguage, t } = useLanguage();
  const params = useParams();
  const navigate = useNavigate();
  const routeUsername = params.username;

  const { profile: profileFromContext } = useProfile();
  const initialProfile = useMemo(() => profileFromContext ?? getProfile(), [profileFromContext]);
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [myPosts, setMyPosts] = useState<ProfilePost[]>([]);

  useEffect(() => {
    if (!profileFromContext) return;
    if (profileFromContext.id !== profile.id || profileFromContext.username !== profile.username || profileFromContext.language !== profile.language) {
      setProfile(profileFromContext);
    }
  }, [profileFromContext, profile.id, profile.username, profile.language]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPostId, setViewerPostId] = useState<string | number | null>(null);
  const [viewerAuthorId, setViewerAuthorId] = useState<string | undefined>(undefined);
  const [viewerAuthorUsername, setViewerAuthorUsername] = useState<string | undefined>(undefined);
  const [profilePictureMenuOpen, setProfilePictureMenuOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);
  const [, setLoadingCommentsByPost] = useState<Record<string, boolean>>({});
  const suppressAutoCloseRef = useRef(false);
  const autoCloseTimeoutRef = useRef<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadSuccess, setShowUploadSuccess] = useState(false);
  const [portraitPreviewUrl, setPortraitPreviewUrl] = useState<string | null>(null);
  const [portraitPreviewFile, setPortraitPreviewFile] = useState<File | null>(null);
  const [portraitPosition, setPortraitPosition] = useState('center');
  const [isUploadingPortrait, setIsUploadingPortrait] = useState(false);
  const [showPortraitConfirm, setShowPortraitConfirm] = useState(false);
  const [showCropConfirm, setShowCropConfirm] = useState(false);
  const [showCropPreview, setShowCropPreview] = useState(false);
  const [portraitPendingFile, setPortraitPendingFile] = useState<File | null>(null);
  const [cropPreviewUrl, setCropPreviewUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffsetX, setCropOffsetX] = useState(0);
  const [cropOffsetY, setCropOffsetY] = useState(0);
  const vibesProFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile.hommies_count ?? 0);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = profileFromContext ?? initialProfile;
  const { user: authUser } = useAuth();
  const viewerId = authUser?.id ?? currentUser?.id;
  const actorUsername = currentUser?.username ?? authUser?.user_metadata?.first_name ?? "";
  const followLabel = isFollowing ? t("profile.following") : isFollowedBy ? t("profile.followBack") : t("profile.follow");

  const openProfilePictureViewer = () => {
    if (!profilePic) return;

    setProfilePictureMenuOpen(false);
    setViewerImages([profilePic]);
    setViewerIndex(0);
    setViewerPostId(null);
    setViewerAuthorId(profile.id);
    setViewerAuthorUsername(profile.username);
    setViewerOpen(true);
  };

  const handleProfilePicClick = () => {
    setProfilePictureMenuOpen((open) => !open);
  };

  const handleProfilePostSelect = async (post: ProfilePost) => {
    setSelectedPostId(post.id);

    if (post.commentList || !profile?.id) return;

    setLoadingCommentsByPost((prev) => ({ ...prev, [String(post.id)]: true }));
    try {
      const commentsData = await getComments(String(post.id));
      const commentList = commentsData.map((comment) => ({
        id: comment.id,
        user: {
          id: comment.author_id,
          username: comment.profiles?.username ?? "Unknown",
        },
        text: comment.text ?? undefined,
        voice: comment.voice_url ?? undefined,
        likes: 0,
      }));

      setMyPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, commentList } : p)));
    } catch (error) {
      console.error("Failed to load comments for profile post", error);
    } finally {
      setLoadingCommentsByPost((prev) => ({ ...prev, [String(post.id)]: false }));
    }
  };

  const handleProfilePostLikeToggle = async (post: ProfilePost) => {
    const profileUser = profileFromContext ?? getProfile();
    if (!profileUser) return;

    const postId = String(post.id);
    const wasLiked = Boolean(post.liked);
    const previousLikes = Number(post.likes ?? post.like_count ?? 0);
    const nextLikes = Math.max(0, previousLikes + (wasLiked ? -1 : 1));

    setMyPosts((prev) =>
      prev.map((p) =>
        p.id === post.id ? { ...p, likes: nextLikes, like_count: nextLikes, liked: !wasLiked } : p
      )
    );

    try {
      if (wasLiked) {
        const removed = await unlikePost(postId, profileUser.id);
        if (!removed) throw new Error("Unlike failed");
      } else {
        const liked = await likePost(postId, profileUser.id);
        if (!liked) throw new Error("Like failed");
      }

      const likesData = await getPostLikes(postId);
      const likesCount = likesData.length;
      const userLikedNow = likesData.some((like) => like.user_id === profileUser.id);

      setMyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likes: likesCount, like_count: likesCount, liked: userLikedNow } : p
        )
      );
    } catch (error) {
      console.error("Failed to sync profile post like state", error);
      setMyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, likes: previousLikes, like_count: previousLikes, liked: wasLiked } : p
        )
      );
    }
  };

  const handleProfilePostAddComment = async (post: ProfilePost, comment: { id: number; text?: string; voice?: string }) => {
    const profileUser = profileFromContext ?? getProfile();
    if (!profileUser) return;

    try {
      const added = await addComment(String(post.id), profileUser.id, comment.text, comment.voice);
      const newComment = {
        id: added?.id ?? comment.id,
        user: { id: profileUser.id, username: profileUser.username ?? profileUser.id },
        text: added?.text ?? comment.text,
        voice: added?.voice_url ?? comment.voice,
        likes: 0,
      };

      setMyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                commentList: [...(p.commentList ?? []), newComment],
                comments: Number((p.comments ?? p.comment_count ?? 0) + 1),
                comment_count: Number((p.comment_count ?? p.comments ?? 0) + 1),
              }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to add comment to profile post", error);
    }
  };

  const handleProfileCommentDelete = async (post: ProfilePost, commentId: number) => {
    const removed = await deleteComment(String(commentId));
    if (!removed) return;

    setMyPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              commentList: p.commentList?.filter((comment) => comment.id !== commentId),
              comments: Math.max(0, Number(p.comments ?? p.comment_count ?? 1) - 1),
              comment_count: Math.max(0, Number(p.comment_count ?? p.comments ?? 1) - 1),
            }
          : p
      )
    );
  };

  const handleProfileCommentEdit = async (post: ProfilePost, commentId: number, newText: string) => {
    try {
      const updated = await editComment(String(commentId), newText);
      if (!updated) return;

      setMyPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                commentList: p.commentList?.map((comment) =>
                  comment.id === commentId ? { ...comment, text: updated.text ?? comment.text } : comment
                ),
              }
            : p
        )
      );
    } catch (error) {
      console.error("Failed to edit profile comment", error);
    }
  };

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

  const handleUploadProfilePicture = () => {
    fileInputRef.current?.click();
    setProfilePictureMenuOpen(false);
  };

  const handleProfileFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setShowUploadSuccess(false);

    try {
      const uploadedUrl = await uploadProfileImage(file);
      if (!uploadedUrl) {
        alert("Unable to upload profile image. Try again.");
        return;
      }

      setUploadProgress(100);
      const updatedProfile = {
        ...profile,
        profilePic: uploadedUrl,
        ...(profile.is_vibes_pro ? { vibes_pro_portrait: uploadedUrl } : {}),
      };
      setProfile((prev) => ({ ...prev, ...updatedProfile }));
      saveProfile({ ...profile, ...updatedProfile });

      if (viewingOwn) {
        await upsertProfileToSupabase(updatedProfile);
      }

      setShowUploadSuccess(true);
      window.setTimeout(() => setShowUploadSuccess(false), 5000);
    } catch (error) {
      console.error("Profile image upload failed", error);
      alert("Profile image upload failed.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const profilePic = profile.profilePic;
  const previewPortraitActive = Boolean(portraitPreviewUrl && portraitPreviewFile);

  const handleVibesProPortraitFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowCropConfirm(true);
    setPortraitPendingFile(file);
    event.target.value = "";
  };

  const handleRequestPortraitChange = () => {
    setShowPortraitConfirm(true);
  };

  const handleConfirmPortraitChange = () => {
    setShowPortraitConfirm(false);
  };

  const handleCancelPortraitChange = () => {
    setShowPortraitConfirm(false);
  };

  const handleCropChoice = (shouldCrop: boolean) => {
    setShowCropConfirm(false);
    if (!portraitPendingFile) return;

    if (shouldCrop) {
      if (portraitPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(portraitPreviewUrl);
      }
      const objectUrl = URL.createObjectURL(portraitPendingFile);
      setCropPreviewUrl(objectUrl);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
      setShowCropPreview(true);
      return;
    }

    if (portraitPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(portraitPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(portraitPendingFile);
    setPortraitPreviewUrl(objectUrl);
    setPortraitPreviewFile(portraitPendingFile);
    setPortraitPosition("center");
    setPortraitPendingFile(null);

    void handleSaveVibesProPortrait(portraitPendingFile);
  };

  const createCroppedPortraitFile = async (file: File, zoom: number, offsetX: number, offsetY: number) => {
    const imageUrl = URL.createObjectURL(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image for cropping"));
      img.src = imageUrl;
    });
    URL.revokeObjectURL(imageUrl);

    const canvas = document.createElement("canvas");
    const size = 1000;
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    const scale = Math.max(1, zoom);
    const sourceWidth = Math.max(1, image.naturalWidth / scale);
    const sourceHeight = Math.max(1, image.naturalHeight / scale);
    const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceWidth, (image.naturalWidth - sourceWidth) / 2 + offsetX));
    const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceHeight, (image.naturalHeight - sourceHeight) / 2 + offsetY));

    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, size, size);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type || "image/jpeg", 0.92);
    });

    if (!blob) {
      return file;
    }

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + "-cropped.jpg", {
      type: blob.type || "image/jpeg",
    });
  };

  const handleApplyCropPreview = async () => {
    if (!portraitPendingFile) return;

    setShowCropPreview(false);
    const croppedFile = await createCroppedPortraitFile(portraitPendingFile, cropZoom, cropOffsetX, cropOffsetY);

    if (cropPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropPreviewUrl);
    }

    const previewObjectUrl = URL.createObjectURL(croppedFile);
    setPortraitPreviewUrl(previewObjectUrl);
    setPortraitPreviewFile(croppedFile);
    setPortraitPosition("center");
    setCropPreviewUrl(null);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setPortraitPendingFile(null);

    await handleSaveVibesProPortrait(croppedFile);
  };

  const handleCancelCropPreview = () => {
    if (cropPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropPreviewUrl);
    }
    setShowCropPreview(false);
    setCropPreviewUrl(null);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setPortraitPendingFile(null);
  };

  const handleSaveVibesProPortrait = async (fileToUpload: File | null = portraitPreviewFile) => {
    if (!fileToUpload) return;

    setIsUploadingPortrait(true);
    try {
      const uploadedUrl = await uploadProfileImage(fileToUpload);
      if (!uploadedUrl) {
        alert("Unable to upload profile image. Try again.");
        return;
      }

      const updatedProfile = { ...profile, vibes_pro_portrait: uploadedUrl, profilePic: profile.profilePic ?? uploadedUrl };
      setProfile((prev) => ({ ...prev, ...updatedProfile }));
      saveProfile({ ...profile, ...updatedProfile });

      if (viewingOwn) {
        await upsertProfileToSupabase(updatedProfile);
      }

      if (portraitPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(portraitPreviewUrl);
      }
      setPortraitPreviewUrl(null);
      setPortraitPreviewFile(null);
      setPortraitPosition("center");
      setPortraitPendingFile(null);
      setShowCropConfirm(false);
      setShowCropPreview(false);
      setCropPreviewUrl(null);
      setCropZoom(1);
      setCropOffsetX(0);
      setCropOffsetY(0);
    } catch (error) {
      console.error("VibesPro portrait upload failed", error);
      alert("VibesPro portrait upload failed.");
    } finally {
      setIsUploadingPortrait(false);
      if (vibesProFileInputRef.current) {
        vibesProFileInputRef.current.value = "";
      }
    }
  };

  const handleCancelVibesProPortrait = () => {
    if (portraitPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(portraitPreviewUrl);
    }
    if (cropPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(cropPreviewUrl);
    }
    setPortraitPreviewUrl(null);
    setPortraitPreviewFile(null);
    setPortraitPosition("center");
    setShowCropPreview(false);
    setCropPreviewUrl(null);
    setCropZoom(1);
    setCropOffsetX(0);
    setCropOffsetY(0);
    setPortraitPendingFile(null);
  };

  const handleAdjustVibesProPortraitPosition = (nextPosition: string) => {
    setPortraitPosition(nextPosition);
  };

  const bio = profile.bio;
  const selectedInterests = Array.isArray(profile.interests) ? profile.interests : [];
  const username = profile.username;
  const email = profile.email;

  const viewingOwn = !routeUsername || routeUsername === currentUser?.username;
  const isVibesPro = (profile.is_vibes_pro === true);

  const vibesCount = myPosts.length;
  const snapshotsCount = myPosts.filter((post) => Boolean(post.image)).length;
  const hommiesCount = viewingOwn ? profile.hommies_count ?? 0 : followersCount;

  // Initialize language from profile when component mounts
  useEffect(() => {
    if (profile.language) {
      setLanguage(normalizeLanguage(profile.language));
    }
  }, [profile.language, setLanguage]);

  const profileScrollKey = useMemo(
    () => (routeUsername ? `metoyou-profile-scroll:${routeUsername}` : "metoyou-profile-scroll:me"),
    [routeUsername]
  );

  useEffect(() => {
    if (!isUploading) return;

    const interval = window.setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + 1;
      });
    }, 120);

    return () => window.clearInterval(interval);
  }, [isUploading]);

  useEffect(() => {
    const savedPosition = Number(sessionStorage.getItem(profileScrollKey) || "0");
    if (savedPosition && typeof window !== "undefined") {
      window.requestAnimationFrame(() => window.scrollTo(0, savedPosition));
    }

    return () => {
      try {
        sessionStorage.setItem(profileScrollKey, String(window.scrollY || 0));
      } catch (e) {
        // ignore storage failures
      }
    };
  }, [profileScrollKey]);

  // Load profile: prefer route `:username` as source of truth.
  useEffect(() => {
    let mounted = true;
    const cacheKey = routeUsername ? `metoyou-profile:${routeUsername}` : `metoyou-profile:me`;
    const lastKey = `${cacheKey}:lastFetch`;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as ProfileData;
        setProfile((prev: ProfileData) => ({ ...prev, ...cached }));
        if (cached.language) setLanguage(normalizeLanguage(cached.language));
      }
    } catch (e) {
      // ignore parse failures
    }

    void (async () => {
      try {
        const last = Number(sessionStorage.getItem(lastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return;

        const remote = routeUsername
          ? await fetchProfileByUsername(routeUsername)
          : await fetchProfileFromSupabase();

        if (!mounted || !remote) return;

        setProfile((prev) => ({ ...prev, ...remote }));
        if (remote.language) setLanguage(normalizeLanguage(remote.language));

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(remote));
          sessionStorage.setItem(lastKey, String(Date.now()));
        } catch (e) {
          // ignore storage failures
        }
      } catch (err) {
        console.warn("Failed to load profile", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [routeUsername, setLanguage]);

  // Load user's posts from Supabase when profile id changes
  useEffect(() => {
    let mounted = true;
    if (!profile?.id) return;

    const postsKey = `metoyou-profile-posts:${profile.id}`;
    const postsLastKey = `${postsKey}:lastFetch`;

    try {
      const raw = sessionStorage.getItem(postsKey);
      if (raw) {
        const cached = JSON.parse(raw) as ProfilePost[];
        setMyPosts(cached);
      }
    } catch (e) {
      // ignore parse failures
    }

    void (async () => {
      try {
        const last = Number(sessionStorage.getItem(postsLastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return;

        const records = await fetchPostsFromSupabase({ author_id: profile.id, limit: 50 });
        if (!mounted) return;

        const mapped = (records || []).map((r: any) => ({
          id: r.id,
          author: { id: r.author_id, username: r.profiles?.username ?? r.author_id },
          text: r.text ?? "",
          image: r.image_url ?? undefined,
          highlighted: Boolean(r.highlighted),
          time: new Date(r.created_at).toLocaleString(),
          likes: Number(r.likes_count ?? 0),
          liked: false,
          comments: Number(r.comments_count ?? 0),
          commentList: undefined,
        } as ProfilePost));

        setMyPosts(mapped);
        try {
          sessionStorage.setItem(postsKey, JSON.stringify(mapped));
          sessionStorage.setItem(postsLastKey, String(Date.now()));
        } catch (e) {
          // ignore storage failures
        }
      } catch (err) {
        console.warn("Failed to load profile posts", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [profile.id]);

  useEffect(() => {
    if (viewingOwn) {
      setFollowersCount(profile.hommies_count ?? 0);
      return;
    }

    let mounted = true;
    const followKey = `metoyou-follow:${viewerId}:${profile.id}`;
    const followLastKey = `${followKey}:lastFetch`;

    try {
      const raw = sessionStorage.getItem(followKey);
      if (raw) {
        const cached = JSON.parse(raw) as { isFollowing: boolean; isFollowedBy: boolean; followersCount: number };
        setIsFollowing(Boolean(cached.isFollowing));
        setIsFollowedBy(Boolean(cached.isFollowedBy));
        setFollowersCount(cached.followersCount ?? profile.hommies_count ?? 0);
      }
    } catch (e) {
      // ignore cache failures
    }

    void (async () => {
      if (!viewerId || !profile?.id) return;
      try {
        const last = Number(sessionStorage.getItem(followLastKey) || "0");
        const now = Date.now();
        if (last && now - last < 30_000) return;

        const status = await getFollowStatus(viewerId, profile.id);
        if (!mounted) return;

        setIsFollowing(status.isFollowing);
        setIsFollowedBy(status.isFollowedBy);
        setFollowersCount(status.followersCount);

        try {
          sessionStorage.setItem(followKey, JSON.stringify(status));
          sessionStorage.setItem(followLastKey, String(Date.now()));
        } catch (e) {
          // ignore storage failures
        }
      } catch (err) {
        console.warn("Failed to load follow status", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [profile.id, viewerId, viewingOwn]);

  const handleFollowToggle = async () => {
    if (!viewerId || !profile?.id || viewingOwn || followLoading) return;

    setFollowLoading(true);

    if (isFollowing) {
      const success = await unfollowUser(viewerId, profile.id);
      if (success) {
        setIsFollowing(false);
        setFollowersCount((count: number) => Math.max(0, count - 1));
      }
    } else {
      const success = await followUser(viewerId, profile.id, actorUsername);
      if (success) {
        setIsFollowing(true);
        setFollowersCount((count: number) => count + 1);
      }
    }

    setFollowLoading(false);
  };

  const handleMessage = () => {
    if (!profile?.id || viewingOwn) return;
    navigate(`/chat?recipient=${profile.id}&username=${encodeURIComponent(profile.username)}`);
  };

  return (
    <div className={`${isVibesPro ? 'fixed inset-0 z-0 overflow-hidden bg-[#0B0B0B]' : 'app-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-3 md:p-6 pt-24 md:pt-32 pb-20 md:pb-24'}`}>
      <div className={`mx-auto ${isVibesPro ? 'w-full max-w-none' : 'max-w-2xl'}`}>
        {!isVibesPro && (
          <div className="flex items-center justify-center pt-4 md:pt-6 mb-6 md:mb-8">
            <h1 className="text-2xl md:text-4xl font-black bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              MeToYou 💜
            </h1>
          </div>
        )}

        {isVibesPro ? (
          <div className="w-full">
            <VibesProProfilePage
              username={profile.username}
              portraitUrl={profile.vibes_pro_portrait ?? profile.profilePic ?? "/default-avatar.png"}
              badgeLabel="Vibes Pro"
              subtitle={bio ?? 'Live like royalty, share your brightest moments.'}
              posts={myPosts.map((post) => ({
                id: post.id,
                title: post.text.slice(0, 40),
                description: post.text,
                mediaUrl: post.image,
                mediaType: post.image ? 'image' : undefined,
                badgeLabel: post.highlighted ? 'Highlight' : 'Snapshot',
                likes: (post.like_count ?? post.likes) ?? 0,
                comments: (post.comment_count ?? post.comments) ?? 0,
              }))}
              hommiesCount={hommiesCount}
              isOnline={true}
              isFollowing={isFollowing}
              followLabel={followLabel}
              viewingOwn={viewingOwn}
              onFollow={handleFollowToggle}
              onMessage={handleMessage}
              onUploadPortrait={handleVibesProPortraitFileChange}
              onRequestPortraitUpload={handleRequestPortraitChange}
              onConfirmPortraitUpload={handleConfirmPortraitChange}
              onCancelPortraitUpload={handleCancelPortraitChange}
              onChooseCropPortrait={handleCropChoice}
              onSavePortrait={handleSaveVibesProPortrait}
              onCancelPortrait={handleCancelVibesProPortrait}
              onAdjustPortraitPosition={handleAdjustVibesProPortraitPosition}
              onApplyCropPreview={handleApplyCropPreview}
              onCancelCropPreview={handleCancelCropPreview}
              onCropZoomChange={setCropZoom}
              onCropOffsetXChange={setCropOffsetX}
              onCropOffsetYChange={setCropOffsetY}
              portraitPosition={portraitPosition}
              isUploadingPortrait={isUploadingPortrait}
              previewPortraitActive={previewPortraitActive}
              showPortraitConfirm={showPortraitConfirm}
              showCropConfirm={showCropConfirm}
              showCropPreview={showCropPreview}
              cropPreviewUrl={cropPreviewUrl}
              cropZoom={cropZoom}
              cropOffsetX={cropOffsetX}
              cropOffsetY={cropOffsetY}
            />
          </div>
        ) : (
          <>
            <div className="bg-white/20 backdrop-blur-3xl rounded-3xl md:rounded-4xl p-4 md:p-8 shadow-2xl border border-white/30">
              {viewingOwn && (
                <div className="flex items-center justify-end gap-2 md:gap-4 mb-4 md:mb-6">
                  <Link
                    to="/settings"
                    className="inline-flex items-center gap-1 md:gap-2 rounded-full border border-white/60 bg-white/40 px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm font-semibold text-slate-900 shadow-xl backdrop-blur-2xl transition hover:scale-[1.02]"
                  >
                    <Settings2 className="w-3 h-3 md:w-4 md:h-4" />
                    {t("profile.settings")}
                  </Link>
                </div>
              )}

              <div className="flex justify-center relative w-full">
                <button
                  type="button"
                  onClick={handleProfilePicClick}
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 p-1 shadow-2xl focus:outline-none"
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-4xl md:text-6xl overflow-hidden">
                    {profilePic ? (
                      <img src={profilePic} alt="profile picture" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl md:text-6xl">😎</div>
                    )}
                  </div>
                </button>

                {profilePictureMenuOpen && (
                  <div className="absolute top-full mt-3 w-56 md:w-64 rounded-3xl bg-white/95 border border-white/80 shadow-xl py-3 text-left z-20">
                    <button
                      type="button"
                      onClick={openProfilePictureViewer}
                      className="w-full text-left px-3 md:px-4 py-3 text-sm md:text-base hover:bg-slate-100 transition"
                    >
                      {t("profile.viewPicture")}
                    </button>
                    {viewingOwn && (
                      <button
                        type="button"
                        onClick={handleUploadProfilePicture}
                        className="w-full text-left px-3 md:px-4 py-3 text-sm md:text-base hover:bg-slate-100 transition"
                      >
                        {isUploading ? t("profile.uploadingProfilePicture") : t("profile.updatePicture")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfileFileChange}
              className="hidden"
            />

            {isUploading && (
              <div className="mt-6 md:mt-8 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-lg backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>Uploading profile picture</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {showUploadSuccess && (
              <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-lg backdrop-blur">
                {t("profile.uploadSuccess")}
              </div>
            )}

            <div className="mt-6 md:mt-8 text-center">
              <p className="uppercase text-xs md:text-sm tracking-[0.3em] text-slate-500">@{username.toLowerCase().replace(/\s+/g, "")}</p>
              <h2 className="text-2xl md:text-3xl font-black mt-2">{username}</h2>
              <p className="text-xs md:text-sm text-slate-600 mt-2">{email}</p>
            </div>

            {!viewingOwn && (
              <div className="mt-4 md:mt-6 flex items-center justify-between gap-2 md:gap-3 bg-white/20 backdrop-blur-3xl rounded-3xl p-3 md:p-4 border border-white/30">
                <FollowButton
                  label={followLoading ? t("profile.working") : followLabel}
                  isFollowing={isFollowing}
                  loading={followLoading}
                  onClick={handleFollowToggle}
                  disabled={false}
                />

                <Link
                  to={`/chat?recipient=${profile.id}&username=${encodeURIComponent(profile.username)}`}
                  className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white shadow-lg border border-white/60 text-slate-900 text-lg md:text-xl transition hover:scale-105 shrink-0"
                  aria-label={t("profile.messageUser")}
                >
                  💬
                </Link>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6 md:mt-8">
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{hommiesCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">{t("profile.hommies")}</p>
              </div>
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{snapshotsCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">{t("profile.snapshots")}</p>
              </div>
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{vibesCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">{t("profile.vibes")}</p>
              </div>
            </div>

            {bio && (
              <div className="mt-6 md:mt-8 bg-white/30 rounded-3xl p-4 md:p-6 shadow-lg">
                <h2 className="font-bold text-xl md:text-2xl mb-3 text-slate-900">{t("profile.aboutMe")}</h2>
                <p className="text-slate-700 text-sm md:text-base leading-relaxed">{bio}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-6 md:mt-8">
              {selectedInterests.map((interest: string) => (
                <span key={interest} className="bg-white/40 backdrop-blur-2xl border border-white/50 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm text-slate-900 shadow-lg">
                  {interest}
                </span>
              ))}
            </div>

            <div className="mt-6 md:mt-8">
              <h2 className="font-bold text-xl md:text-2xl mb-3 md:mb-4">{t("profile.highlights")}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
                {myPosts.filter((post) => post.highlighted).length > 0 ? (
                  myPosts
                    .filter((post) => post.highlighted)
                    .map((post) => (
                      <div key={post.id} className="rounded-3xl overflow-hidden bg-white/80 border border-white/70 shadow-md">
                        {post.image ? (
                          <img src={post.image} alt={post.text} className="w-full h-32 md:h-40 object-cover" />
                        ) : (
                          <div className="h-32 md:h-40 flex items-center justify-center bg-pink-100 text-slate-700 px-3 md:px-4 text-xs md:text-sm text-center">
                            {post.text}
                          </div>
                        )}
                        <div className="p-2 md:p-4">
                          <p className="font-semibold text-slate-800 text-xs md:text-sm line-clamp-2">{post.text}</p>
                          <p className="text-xs text-slate-500 mt-1 md:mt-2">{post.time}</p>
                        </div>
                      </div>
                    ))
                ) : (
                  <div className="col-span-full rounded-3xl bg-white/60 border border-dashed border-slate-300 p-6 text-center text-slate-500">
                    {t("profile.noHighlights")}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 md:mt-8">
              <h2 className="font-bold text-xl md:text-2xl mb-3 md:mb-4">{t("profile.mySnapshots")}</h2>
              <div className="space-y-4">
                {myPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    author={post.author ?? { id: profile.id, username: profile.username }}
                    authorId={post.author?.id ?? profile.id}
                    postId={post.id}
                    time={post.time ?? ""}
                    text={post.text}
                    image={post.image}
                    comments={((post.commentList ?? []) as Array<{ id: string | number; user: { id: string; username: string }; text?: string; voice?: string; likes?: number }>).map((comment) => ({
                      ...comment,
                      likes: comment.likes ?? 0,
                    }))}
                    likes={post.likes ?? 0}
                    liked={Boolean(post.liked)}
                    isSelected={selectedPostId === post.id}
                    onToggleLike={() => void handleProfilePostLikeToggle(post)}
                    onSelectPost={() => void handleProfilePostSelect(post)}
                    onClosePost={() => {
                      if (selectedPostId === post.id) setSelectedPostId(null);
                    }}
                    onInteractionActivity={setAutoCloseSuppressed}
                    onAddComment={(comment) => void handleProfilePostAddComment(post, comment)}
                    onDeleteComment={(commentId) => void handleProfileCommentDelete(post, commentId)}
                    onEditComment={(commentId, newText) => void handleProfileCommentEdit(post, commentId, newText)}
                  />
                ))}
              </div>
            </div>

            {/* The conditional logic container is now clean and within the fragment branch boundary */}
            {viewerOpen && viewerImages.length > 0 && (
              <ImageViewer
                images={viewerImages}
                initialIndex={viewerIndex}
                onClose={() => setViewerOpen(false)}
                postId={viewerPostId ?? undefined}
                authorId={viewerAuthorId}
                authorUsername={viewerAuthorUsername}
                variant={profile?.is_vibes_pro ? "vibespro" : "default"}
                onEditPost={() => {
                  const newText = window.prompt("Edit post text:", viewerImages[viewerIndex] ? undefined : "");
                  if (newText !== null) {
                    setMyPosts((prev) => prev.map((p) => (p.id === viewerPostId ? { ...p, text: newText } : p)));
                  }
                }}
                onDeleteImage={() => {
                  setMyPosts((prev) => prev.map((p) => (p.id === viewerPostId ? { ...p, image: undefined } : p)));
                  setViewerOpen(false);
                }}
                onDeletePost={() => {
                  setMyPosts((prev) => prev.filter((p) => p.id !== viewerPostId));
                  setViewerOpen(false);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}