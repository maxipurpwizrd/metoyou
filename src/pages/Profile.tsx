import { Link, useNavigate, useParams } from "react-router-dom";
import type { ChangeEvent } from "react";
import { useState, useEffect, useRef } from "react";
import { getProfile, saveProfile } from "../utils/profileStorage";
import { fetchProfileFromSupabase, fetchProfileByUsername, upsertProfileToSupabase, uploadProfileImage } from "../lib/profileApi";
import { fetchPostsFromSupabase } from "../lib/postApi";
import { followUser, unfollowUser, getFollowStatus } from "../lib/followApi";
import FollowButton from "../components/social/FollowButton";
import { useAuth } from "../hooks/useAuth";
import type { ProfileData } from "../utils/profileStorage";
import { useLanguage } from "../contexts/LanguageContext";
import { normalizeLanguage } from "../lib/i18n";
import ImageViewer from "../components/ImageViewer";
import VibesProProfilePage from "../components/VibesPro/VibesProProfilePage";
import { Settings2 } from "lucide-react";

type ProfilePost = {
  id: string | number;
  author: { id: string; username: string };
  text: string;
  image?: string;
  highlighted?: boolean;
  time?: string;
  likes?: number;
  comments?: number;
  like_count?: number;
  comment_count?: number;
};


export default function Profile() {
  const { setLanguage } = useLanguage();
  const params = useParams();
  const navigate = useNavigate();
  const routeUsername = params.username;

  const [profile, setProfile] = useState<ProfileData>(() => getProfile());
  const [myPosts, setMyPosts] = useState<ProfilePost[]>([]);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPostId, setViewerPostId] = useState<string | number | null>(null);
  const [viewerAuthorId, setViewerAuthorId] = useState<string | undefined>(undefined);
  const [viewerAuthorUsername, setViewerAuthorUsername] = useState<string | undefined>(undefined);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [followersCount, setFollowersCount] = useState(profile.hommies_count ?? 0);
  const [followLoading, setFollowLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentUser = getProfile();
  const { user: authUser } = useAuth();
  const viewerId = authUser?.id ?? currentUser?.id;
  const actorUsername = currentUser?.username ?? authUser?.user_metadata?.first_name ?? "Someone";
  const followLabel = isFollowing ? "Following" : isFollowedBy ? "Follow Back" : "Follow";

  const handleProfilePicClick = () => {
    setAvatarMenuOpen((open) => !open);
  };

  const handleUploadProfilePicture = () => {
    fileInputRef.current?.click();
    setAvatarMenuOpen(false);
  };

  const handleProfileFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploadedUrl = await uploadProfileImage(file);
      if (!uploadedUrl) {
        alert("Unable to upload profile image. Try again.");
        return;
      }

      const updatedProfile = profile.is_vibes_pro
        ? { ...profile, vibes_pro_portrait: uploadedUrl }
        : { ...profile, profilePic: uploadedUrl };
      setProfile(updatedProfile);
      saveProfile(updatedProfile);

      if (viewingOwn) {
        await upsertProfileToSupabase(updatedProfile);
      }
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

  const updateProfile = (updated: ProfileData) => {
    setProfile(updated);
    saveProfile(updated);
  };

  const profilePic = profile.profilePic;
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

  // Load profile: prefer route `:username` as source of truth.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (routeUsername) {
          // load the profile for the given username
          const remote = await fetchProfileByUsername(routeUsername);
          if (!mounted) return;
          if (remote) {
            setProfile(remote);
            if (remote.language) setLanguage(normalizeLanguage(remote.language));
          } else {
            // No such user — navigate away or show fallback
            setProfile((prev) => prev);
          }
        } else {
          // No route username — load authenticated user's profile
          const remote = await fetchProfileFromSupabase();
          if (!mounted) return;
          if (remote) {
            updateProfile(remote);
            if (remote.language) setLanguage(normalizeLanguage(remote.language));
          }
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
    (async () => {
      if (!profile?.id) return;
      try {
        const records = await fetchPostsFromSupabase({ author_id: profile.id, limit: 50 });
        if (!mounted) return;

        const mapped = (records || []).map((r: any) => ({
          id: r.id,
          author: { id: r.author_id, username: r.profiles?.username ?? r.author_id },
          text: r.text ?? "",
          image: r.image_url ?? undefined,
          highlighted: Boolean(r.highlighted),
          time: new Date(r.created_at).toLocaleString(),
        } as ProfilePost));

        setMyPosts(mapped);
      } catch {
        setMyPosts([]);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [profile.id, profile.username]);

  useEffect(() => {
    if (viewingOwn) {
      setFollowersCount(profile.hommies_count ?? 0);
      return;
    }

    let mounted = true;
    const loadFollowStatus = async () => {
      if (!viewerId || !profile?.id) return;
      const status = await getFollowStatus(viewerId, profile.id);
      if (!mounted) return;

      setIsFollowing(status.isFollowing);
      setIsFollowedBy(status.isFollowedBy);
      setFollowersCount(status.followersCount);
    };

    loadFollowStatus();

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
        setFollowersCount((count) => Math.max(0, count - 1));
      }
    } else {
      const success = await followUser(viewerId, profile.id, actorUsername);
      if (success) {
        setIsFollowing(true);
        setFollowersCount((count) => count + 1);
      }
    }

    setFollowLoading(false);
  };

  const handleMessage = () => {
    if (!profile?.id || viewingOwn) return;
    navigate(`/chat?recipient=${profile.id}&username=${encodeURIComponent(profile.username)}`);
  };

  return (
    <div className={`min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 ${isVibesPro ? 'px-0 pt-0 pb-0' : 'p-3 md:p-6 pt-24 md:pt-32 pb-20 md:pb-24'}`}>
      <div className={`mx-auto ${isVibesPro ? 'w-full max-w-none' : 'max-w-2xl'}`}>
        {!isVibesPro && (
          <div className="flex items-center justify-between mb-6 md:mb-8 relative">
            <h1 className="text-2xl md:text-4xl font-black bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent absolute left-1/2 -translate-x-1/2">
              MeToYou 💜
            </h1>

            {/* owner controls removed */}
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
                    Settings
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
                      <img src={profilePic} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl md:text-6xl">😎</div>
                    )}
                  </div>
                </button>

                {avatarMenuOpen && (
                  <div className="absolute top-full mt-3 w-56 md:w-64 rounded-3xl bg-white/95 border border-white/80 shadow-xl py-3 text-left z-20">
                    {viewingOwn && (
                      <button
                        type="button"
                        onClick={handleUploadProfilePicture}
                        className="w-full text-left px-3 md:px-4 py-3 text-sm md:text-base hover:bg-slate-100 transition"
                      >
                        {isUploading ? "Uploading avatar..." : "Upload new profile"}
                      </button>
                    )}
                    <Link
                      to={viewingOwn ? "/profile" : `/profile/${currentUser?.username}`}
                      onClick={() => setAvatarMenuOpen(false)}
                      className="block px-3 md:px-4 py-3 text-sm md:text-base text-left hover:bg-slate-100 transition"
                    >
                      View profile
                    </Link>
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

            <div className="mt-6 md:mt-8 text-center">
              <p className="uppercase text-xs md:text-sm tracking-[0.3em] text-slate-500">@{username.toLowerCase().replace(/\s+/g, "")}</p>
              <h2 className="text-2xl md:text-3xl font-black mt-2">{username}</h2>
              <p className="text-xs md:text-sm text-slate-600 mt-2">{email}</p>
            </div>

            {!viewingOwn && (
              <div className="mt-4 md:mt-6 flex items-center justify-between gap-2 md:gap-3 bg-white/20 backdrop-blur-3xl rounded-3xl p-3 md:p-4 border border-white/30">
                <FollowButton
                  label={followLoading ? "Working..." : followLabel}
                  isFollowing={isFollowing}
                  loading={followLoading}
                  onClick={handleFollowToggle}
                  disabled={false}
                />

                <Link
                  to={`/chat?recipient=${profile.id}&username=${encodeURIComponent(profile.username)}`}
                  className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-white shadow-lg border border-white/60 text-slate-900 text-lg md:text-xl transition hover:scale-105 shrink-0"
                  aria-label="Message user"
                >
                  💬
                </Link>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-6 md:mt-8">
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{hommiesCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">Hommies</p>
              </div>
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{snapshotsCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">Snapshots</p>
              </div>
              <div className="bg-white/30 rounded-2xl p-3 md:p-4 text-center shadow-lg">
                <h2 className="font-black text-2xl md:text-3xl text-slate-900">{vibesCount}</h2>
                <p className="text-slate-700 text-xs md:text-sm mt-2">Vibes</p>
              </div>
            </div>

            {bio && (
              <div className="mt-6 md:mt-8 bg-white/30 rounded-3xl p-4 md:p-6 shadow-lg">
                <h2 className="font-bold text-xl md:text-2xl mb-3 text-slate-900">About Me</h2>
                <p className="text-slate-700 text-sm md:text-base leading-relaxed">{bio}</p>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 md:gap-3 mt-6 md:mt-8">
              {selectedInterests.map((interest) => (
                <span key={interest} className="bg-white/40 backdrop-blur-2xl border border-white/50 px-3 md:px-4 py-2 rounded-full text-xs md:text-sm text-slate-900 shadow-lg">
                  {interest}
                </span>
              ))}
            </div>

            <div className="mt-6 md:mt-8">
              <h2 className="font-bold text-xl md:text-2xl mb-3 md:mb-4">Highlights ✨</h2>
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
                    No highlighted posts yet. Mark a post as a highlight from feed to show it here.
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 md:mt-8">
              <h2 className="font-bold text-xl md:text-2xl mb-3 md:mb-4">My Snapshots 📸</h2>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-1 md:gap-2">
                {myPosts.map((post) => (
                  <div
                    key={post.id}
                    className="aspect-square rounded-2xl overflow-hidden bg-gray-200 shadow-md hover:shadow-lg transition cursor-pointer"
                    onClick={() => {
                      if (post.image) {
                        setViewerImages([post.image]);
                        setViewerIndex(0);
                        setViewerPostId(post.id);
                        setViewerAuthorId(post.author?.id);
                        setViewerAuthorUsername(post.author?.username);
                        setViewerOpen(true);
                      }
                    }}
                  >
                    {post.image ? (
                      <img src={post.image} alt={post.text} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-pink-300 to-blue-300 p-2 text-center">
                        <p className="text-xs font-semibold text-white line-clamp-3">{post.text}</p>
                      </div>
                    )}
                  </div>
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