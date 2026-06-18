import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { getProfile, saveProfile } from "../utils/profileStorage";
import { fetchProfileFromSupabase, upsertProfileToSupabase } from "../lib/profileApi";
import type { ProfileData } from "../utils/profileStorage";
import { useLanguage } from "../contexts/LanguageContext";
import type { Language } from "../lib/i18n";
import ImageViewer from "../components/ImageViewer";

type ProfilePost = {
  id: string | number;
  author: { id: string; username: string };
  text: string;
  image?: string;
  highlighted?: boolean;
  time?: string;
};

const AVAILABLE_INTERESTS = [
  "Travel",
  "Music",
  "Fitness",
  "Food",
  "Gaming",
  "Art",
  "Technology",
  "Fashion",
  "Sports",
  "Movies",
  "Books",
  "Nature",
];

export default function Profile() {
  const navigate = useNavigate();
  const { setLanguage, t } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(() => getProfile());
  const [myPosts, setMyPosts] = useState<ProfilePost[]>(() => {
    const saved = localStorage.getItem("metoyou-posts");
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((post) => {
        return post?.author?.id === profile.id || post?.author?.username === profile.username;
      });
    } catch {
      return [];
    }
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [appearance, setAppearance] = useState<"light" | "dark">("light");
  const [postNotifications, setPostNotifications] = useState(true);
  const [commentNotifications, setCommentNotifications] = useState(true);
  const [messageNotifications, setMessageNotifications] = useState(true);
  
  const [settingsView, setSettingsView] = useState<
    | "main"
    | "edit"
    | "changePic"
    | "bio"
    | "privacy"
    | "notifications"
    | "appearance"
    | "help"
    | "language"
    | "interests"
  >("main");
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerPostId, setViewerPostId] = useState<string | number | null>(null);
  const [viewerAuthorId, setViewerAuthorId] = useState<string | undefined>(undefined);
  const [viewerAuthorUsername, setViewerAuthorUsername] = useState<string | undefined>(undefined);

  const updateProfile = (updated: ProfileData) => {
    setProfile(updated);
    saveProfile(updated);
  };

  const updateField = <K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    updateProfile({ ...profile, [key]: value });
  };

  const handleAvatarClick = () => {
    setAvatarMenuOpen(true);
  };

  const handleProfileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const newProfile = { ...profile, profilePic: reader.result as string };
      updateProfile(newProfile);
      upsertProfileToSupabase(newProfile);
    };
    reader.readAsDataURL(file);
  };

  const profilePic = profile.profilePic;
  const bio = profile.bio;
  const selectedInterests = Array.isArray(profile.interests) ? profile.interests : [];
  const username = profile.username;
  const email = profile.email;

  const vibesCount = myPosts.length;
  const snapshotsCount = myPosts.filter((post) => Boolean(post.image)).length;
  const hommiesCount = profile.hommies_count ?? 0;

  // Initialize language from profile when component mounts
  useEffect(() => {
    if (profile.language) {
      // Migrate old language format to new format
      let lang: Language = "English-US";
      if (profile.language === "English-US" || profile.language === "English-Slang" || profile.language === "French") {
        lang = profile.language as Language;
      } else if (profile.language === "English") {
        lang = "English-US"; // migrate old "English" to new format
      }
      setLanguage(lang);
    }
  }, [profile.language, setLanguage]);

  // Load profile from Supabase on mount only
  useEffect(() => {
    (async () => {
      try {
        const remote = await fetchProfileFromSupabase();
        if (remote) {
          updateProfile(remote);
          if (remote.language) {
            setLanguage(remote.language as Language);
          }
        }
      } catch {
        // ignore - fallback to local
      }
    })();
  }, [setLanguage]); // Only run on mount, not on every profile change

  // Refresh posts when profile id or username changes
  useEffect(() => {
    const refreshPosts = () => {
      const saved = localStorage.getItem("metoyou-posts");
      if (!saved) {
        setMyPosts([]);
        return;
      }

      try {
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) {
          setMyPosts([]);
          return;
        }

        setMyPosts(
          parsed.filter((post) => {
            return post?.author?.id === profile.id || post?.author?.username === profile.username;
          })
        );
      } catch {
        setMyPosts([]);
      }
    };

    refreshPosts();
  }, [profile.id, profile.username]); // Only depend on id and username, not entire profile

  return (
    <div className="min-h-screen bg-linear-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pt-32 pb-28">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-8 relative">
          <Link
            to="/feed"
            className="inline-block bg-white/40 backdrop-blur-2xl border border-white/50 rounded-2xl px-5 py-3 shadow-xl font-semibold"
          >
            {t("profile.hitStreets")}
          </Link>

          <h1 className="text-4xl font-black bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent absolute left-1/2 -translate-x-1/2">
            MeToYou 💜
          </h1>

          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-white/40 backdrop-blur-xl px-3 py-2 rounded-xl shadow-md hover:scale-105 transition text-2xl"
          >
            ⚙️
          </button>
        </div>

        <div className="bg-white/40 backdrop-blur-2xl rounded-3xl p-8 shadow-xl border border-white/50">
          <div className="flex justify-center">
            <div
              onClick={handleAvatarClick}
              className="cursor-pointer w-40 h-40 rounded-full bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 p-1 shadow-2xl"
            >
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-6xl overflow-hidden">
                {profilePic ? (
                  <img src={profilePic} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">😎</div>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleProfileUpload}
          />

          {avatarMenuOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setAvatarMenuOpen(false)}></div>
              <div className="relative bg-white rounded-3xl p-6 shadow-2xl z-10 w-full max-w-sm">
                <h2 className="text-2xl font-bold text-center mb-6">Profile Picture</h2>
                <div className="space-y-3">
                  <button
                    onClick={() => setAvatarMenuOpen(false)}
                    className="w-full bg-blue-500 text-white py-3 rounded-2xl font-semibold hover:bg-blue-600 transition"
                  >
                    👀 View Picture
                  </button>
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setAvatarMenuOpen(false);
                    }}
                    className="w-full bg-pink-500 text-white py-3 rounded-2xl font-semibold hover:bg-pink-600 transition"
                  >
                    📸 Change Picture
                  </button>
                  <button
                    onClick={() => setAvatarMenuOpen(false)}
                    className="w-full bg-gray-300 text-black py-3 rounded-2xl font-semibold hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 text-center">
            <p className="uppercase text-sm tracking-[0.3em] text-slate-500">@{username.toLowerCase().replace(/\s+/g, "")}</p>
            <h2 className="text-3xl font-black mt-2">{username}</h2>
            <p className="text-sm text-slate-600 mt-2">{email}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8">
            <div className="bg-white/50 rounded-2xl p-4 text-center shadow">
              <h2 className="font-black text-3xl">{hommiesCount}</h2>
              <p>Hommies</p>
            </div>
            <div className="bg-white/50 rounded-2xl p-4 text-center shadow">
              <h2 className="font-black text-3xl">{snapshotsCount}</h2>
              <p>Snapshots</p>
            </div>
            <div className="bg-white/50 rounded-2xl p-4 text-center shadow">
              <h2 className="font-black text-3xl">{vibesCount}</h2>
              <p>Vibes</p>
            </div>
          </div>

          <div className="mt-8 bg-white/30 rounded-2xl p-5">
            <h2 className="font-bold text-2xl mb-3">About Me</h2>
            <p className="text-gray-700 leading-relaxed">{bio}</p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {selectedInterests.map((interest) => (
              <span key={interest} className="bg-pink-200/70 px-4 py-2 rounded-full text-sm">
                {interest}
              </span>
            ))}
          </div>

          <div className="mt-8">
            <h2 className="font-bold text-2xl mb-4">Highlights ✨</h2>
            <div className="grid grid-cols-2 gap-3">
              {myPosts.filter((post) => post.highlighted).length > 0 ? (
                myPosts
                  .filter((post) => post.highlighted)
                  .map((post) => (
                    <div key={post.id} className="rounded-3xl overflow-hidden bg-white/80 border border-white/70 shadow-md">
                      {post.image ? (
                        <img src={post.image} alt={post.text} className="w-full h-40 object-cover" />
                      ) : (
                        <div className="h-40 flex items-center justify-center bg-pink-100 text-slate-700 px-4 text-sm text-center">
                          {post.text}
                        </div>
                      )}
                      <div className="p-4">
                        <p className="font-semibold text-slate-800">{post.text}</p>
                        <p className="text-xs text-slate-500 mt-2">{post.time}</p>
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

          <div className="mt-8">
            <h2 className="font-bold text-2xl mb-4">My Snapshots 📸</h2>
            <div className="grid grid-cols-3 gap-2">
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
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-pink-300 to-blue-300 p-4 text-center">
                      <p className="text-sm font-semibold text-white">{post.text}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

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
      </div>
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSettingsOpen(false)}></div>

          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl z-10">
            <button onClick={() => setSettingsOpen(false)} className="absolute top-4 right-4 text-xl">✕</button>
            <h2 className="text-2xl font-bold mb-4">{t("profile.settingsTitle")}</h2>

            {settingsView === "main" && (
              <div className="space-y-3">
                <button onClick={() => setSettingsView("edit")} className="w-full text-left rounded-2xl border px-4 py-3">👤 {t("profile.editProfile")}</button>
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                  className="w-full text-left rounded-2xl border px-4 py-3"
                >
                  📸 {t("profile.changePicture")}
                </button>
                <button onClick={() => setSettingsView("bio")} className="w-full text-left rounded-2xl border px-4 py-3">💜 {t("profile.editBio")}</button>
                <button onClick={() => setSettingsView("interests")} className="w-full text-left rounded-2xl border px-4 py-3">✨ {t("profile.editInterests") || "Edit Interests"}</button>

                <div className="border-t my-3"></div>

                <button onClick={() => setSettingsView("privacy")} className="w-full text-left rounded-2xl border px-4 py-3">🔒 {t("profile.privacy")}</button>
                <button onClick={() => setSettingsView("notifications")} className="w-full text-left rounded-2xl border px-4 py-3">💬 {t("profile.notifications")}</button>
                <button onClick={() => setSettingsView("appearance")} className="w-full text-left rounded-2xl border px-4 py-3">🌙 {t("profile.appearance")}</button>

                <div className="border-t my-3"></div>

                <button onClick={() => setSettingsView("help")} className="w-full text-left rounded-2xl border px-4 py-3">❓ {t("profile.helpSupport")}</button>

                <button
                  onClick={() => {
                    setSettingsOpen(false);
                    navigate("/");
                  }}
                  className="w-full rounded-2xl bg-red-500 text-white px-4 py-3 mt-2"
                >
                  🚪 {t("profile.logout")}
                </button>
              </div>
            )}

            {settingsView === "edit" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.editProfile")}</h3>
                <label className="block text-sm text-slate-700">{t("profile.username")}
                  <input value={username} onChange={(e) => updateField("username", e.target.value)} className="w-full rounded-2xl border px-3 py-2 mt-2" />
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setSettingsView("main")} className="flex-1 rounded-2xl border px-4 py-2">{t("profile.cancel")}</button>
                  <button
                    onClick={async () => {
                      await upsertProfileToSupabase(profile);
                      saveProfile(profile);
                      setSettingsView("main");
                    }}
                    className="flex-1 rounded-2xl bg-blue-600 text-white px-4 py-2"
                  >
                    {t("profile.save")}
                  </button>
                </div>
              </div>
            )}
            {settingsView === "interests" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.interests") || "Interests"}</h3>
                <p className="text-sm text-slate-600">Select the interests you want saved to your profile.</p>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_INTERESTS.map((interest) => {
                    const active = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? selectedInterests.filter((item) => item !== interest)
                            : [...selectedInterests, interest];
                          updateField("interests", next);
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left ${active ? "bg-pink-500 text-white border-pink-500" : "bg-white text-slate-700"}`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSettingsView("main")} className="flex-1 rounded-2xl border px-4 py-2">{t("profile.cancel")}</button>
                  <button
                    onClick={async () => {
                      await upsertProfileToSupabase(profile);
                      saveProfile(profile);
                      setSettingsView("main");
                    }}
                    className="flex-1 rounded-2xl bg-blue-600 text-white px-4 py-2"
                  >
                    {t("profile.save")}
                  </button>
                </div>
              </div>
            )}

            {settingsView === "bio" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.editBio")}</h3>
                <textarea value={bio} onChange={(e) => updateField("bio", e.target.value)} className="w-full rounded-2xl border px-3 py-2 mt-2 min-h-20" />
                <div className="flex gap-2">
                  <button onClick={() => setSettingsView("main")} className="flex-1 rounded-2xl border px-4 py-2">{t("profile.cancel")}</button>
                  <button
                    onClick={async () => {
                      await upsertProfileToSupabase(profile);
                      saveProfile(profile);
                      setSettingsView("main");
                    }}
                    className="flex-1 rounded-2xl bg-blue-600 text-white px-4 py-2"
                  >
                    {t("profile.save")}
                  </button>
                </div>
              </div>
            )}

            {settingsView === "privacy" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.privacy")}</h3>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3">
                    <span>{t("profile.publicAccount")}</span>
                    <input type="radio" name="privacy" checked={!isPrivateAccount} onChange={() => setIsPrivateAccount(false)} />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3">
                    <span>{t("profile.privateAccount")}</span>
                    <input type="radio" name="privacy" checked={isPrivateAccount} onChange={() => setIsPrivateAccount(true)} />
                  </label>
                </div>
              </div>
            )}

            {settingsView === "notifications" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.notifications")}</h3>
                <div className="space-y-2 mt-2">
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3">
                    <span>{t("profile.messagesNotif")}</span>
                    <input type="checkbox" checked={messageNotifications} onChange={(e) => setMessageNotifications(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3">
                    <span>{t("profile.likesNotif")}</span>
                    <input type="checkbox" checked={postNotifications} onChange={(e) => setPostNotifications(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border px-4 py-3">
                    <span>{t("profile.commentsNotif")}</span>
                    <input type="checkbox" checked={commentNotifications} onChange={(e) => setCommentNotifications(e.target.checked)} />
                  </label>
                </div>
              </div>
            )}

            {settingsView === "appearance" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.appearance")}</h3>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <button onClick={() => setAppearance("light")} className={`rounded-2xl border px-4 py-3 ${appearance === "light" ? "bg-blue-600 text-white" : "bg-white"}`}>{t("profile.lightMode")}</button>
                  <button onClick={() => setAppearance("dark")} className={`rounded-2xl border px-4 py-3 ${appearance === "dark" ? "bg-blue-600 text-white" : "bg-white"}`}>{t("profile.darkMode")}</button>
                </div>
              </div>
            )}

            {settingsView === "language" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← Back</button>
                <h3 className="font-semibold">{t("profile.language")}</h3>

                <label className="flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer">
                  <div>
                    <div className="font-medium">{t("lang.english-us")}</div>
                    <div className="text-xs text-slate-500">Basic English</div>
                  </div>
                  <input
                    type="radio"
                    name="language"
                    checked={profile.language === "English-US"}
                    onChange={() => {
                      updateField("language", "English-US");
                      setLanguage("English-US");
                    }}
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer">
                  <div>
                    <div className="font-medium">{t("lang.english-slang")}</div>
                    <div className="text-xs text-slate-500">Street Slang</div>
                  </div>
                  <input
                    type="radio"
                    name="language"
                    checked={profile.language === "English-Slang"}
                    onChange={() => {
                      updateField("language", "English-Slang");
                      setLanguage("English-Slang");
                    }}
                  />
                </label>

                <label className="flex items-center justify-between rounded-2xl border px-4 py-3 cursor-pointer">
                  <div>
                    <div className="font-medium">{t("lang.french")}</div>
                    <div className="text-xs text-slate-500">France</div>
                  </div>
                  <input
                    type="radio"
                    name="language"
                    checked={profile.language === "French"}
                    onChange={() => {
                      updateField("language", "French");
                      setLanguage("French");
                    }}
                  />
                </label>

                <div className="flex gap-2">
                  <button onClick={() => setSettingsView("main")} className="flex-1 rounded-2xl border px-4 py-2">{t("profile.cancel")}</button>
                  <button
                    onClick={async () => {
                      await upsertProfileToSupabase(profile);
                      saveProfile(profile);
                      setSettingsView("main");
                    }}
                    className="flex-1 rounded-2xl bg-blue-600 text-white px-4 py-2"
                  >
                    {t("profile.save")}
                  </button>
                </div>
              </div>
            )}

            {settingsView === "help" && (
              <div className="space-y-4">
                <button onClick={() => setSettingsView("main")} className="text-sm text-slate-500">← {t("profile.back")}</button>
                <h3 className="font-semibold">{t("profile.helpSupport")}</h3>
                <div className="space-y-2 mt-2">
                  <button className="w-full rounded-2xl border px-4 py-3 text-left">{t("profile.helpCenter")}</button>
                  <button className="w-full rounded-2xl border px-4 py-3 text-left">{t("profile.reportProblem")}</button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
