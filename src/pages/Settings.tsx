import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import type { AppLanguage } from "../lib/i18n";
import {
  ArrowRight,
  AtSign,
  Flag,
  HelpCircle,
  Image,
  Info,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { getProfile, saveProfile, type ProfileData } from "../utils/profileStorage";
import { fetchProfileByUsername, upsertProfileToSupabase, uploadProfileImage } from "../lib/profileApi";
import { logout } from "../lib/auth";

export default function Settings() {
  const initialProfile = getProfile();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [activeModal, setActiveModal] = useState<"name" | "username" | "picture" | "language" | "logout" | null>(null);
  const [name, setName] = useState(initialProfile.firstName ?? initialProfile.username);
  const [username, setUsername] = useState(initialProfile.username);
  const [profilePictureUrl, setProfilePictureUrl] = useState(initialProfile.profilePic ?? "");
  const [selectedProfilePictureFile, setSelectedProfilePictureFile] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<"black-ice" | "pink-glow">(() => {
    const stored = window.localStorage.getItem("metoyou-theme");
    return stored === "pink-glow" ? "pink-glow" : "black-ice";
  });
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    window.localStorage.setItem("metoyou-theme", selectedTheme);
    document.documentElement.dataset.theme = selectedTheme;
  }, [selectedTheme]);

  useEffect(() => {
    return () => {
      if (profilePicturePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(profilePicturePreview);
      }
    };
  }, [profilePicturePreview]);

  const openModal = (modal: "name" | "username" | "picture" | "language" | "logout") => {
    setErrorMessage("");
    setStatusMessage("");
    if (modal !== "picture") {
      setSelectedProfilePictureFile(null);
      setProfilePicturePreview(null);
    }
    setActiveModal(modal);
  };

  async function saveProfileFields(updates: Partial<ProfileData>) {
    setIsSaving(true);
    try {
      const updatedProfile: ProfileData = {
        ...profile,
        ...updates,
        firstName: updates.firstName ?? profile.firstName,
        language: updates.language ?? profile.language,
      };

      const savedProfile = await upsertProfileToSupabase(updatedProfile);
      if (!savedProfile) {
        throw new Error("Unable to save profile");
      }

      saveProfile(savedProfile);
      setProfile(savedProfile);
      setName(savedProfile.firstName ?? savedProfile.username);
      setUsername(savedProfile.username);
      setProfilePictureUrl(savedProfile.profilePic ?? "");
      setStatusMessage("Profile updated successfully.");
    } catch (error) {
      console.error("Settings save error", error);
      setErrorMessage("Unable to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  const handleLanguageSelection = async (selected: AppLanguage) => {
    setLanguage(selected);
    const updatedProfile = { ...profile, language: selected };
    saveProfile(updatedProfile);
    setProfile(updatedProfile);

    try {
      const savedProfile = await upsertProfileToSupabase(updatedProfile);
      if (savedProfile) {
        saveProfile(savedProfile);
        setProfile(savedProfile);
      }
    } catch (error) {
      console.error("Language save error", error);
    } finally {
      setActiveModal(null);
    }
  };

  const handleProfilePictureFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please choose an image file.");
      return;
    }

    setErrorMessage("");
    setSelectedProfilePictureFile(file);
    setProfilePicturePreview(URL.createObjectURL(file));
    setStatusMessage("Image ready to save.");
    event.target.value = "";
  };

  const handleRemoveProfilePicture = async () => {
    setErrorMessage("");
    setStatusMessage("Removing profile picture...");
    setIsSaving(true);

    try {
      await saveProfileFields({ profilePic: "" });
      setProfilePictureUrl("");
      setSelectedProfilePictureFile(null);
      setProfilePicturePreview(null);
      setActiveModal(null);
    } catch (error) {
      console.error("Profile picture removal error", error);
      setErrorMessage("Unable to remove profile picture. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleModalSave = async () => {
    if (activeModal === "name") {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMessage("Please enter a name.");
        return;
      }
      await saveProfileFields({ firstName: trimmedName });
      setActiveModal(null);
      return;
    }

    if (activeModal === "username") {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) {
        setErrorMessage("Please enter a username.");
        return;
      }

      if (trimmedUsername !== profile.username) {
        const existingProfile = await fetchProfileByUsername(trimmedUsername);
        if (existingProfile && existingProfile.id !== profile.id) {
          setErrorMessage("This username is already taken.");
          return;
        }
      }

      await saveProfileFields({ username: trimmedUsername });
      setActiveModal(null);
      return;
    }

    if (activeModal === "picture") {
      if (selectedProfilePictureFile) {
        setErrorMessage("");
        setStatusMessage("Uploading profile picture...");
        setIsSaving(true);

        try {
          const uploadedUrl = await uploadProfileImage(selectedProfilePictureFile);
          if (!uploadedUrl) {
            throw new Error("Image upload failed");
          }

          await saveProfileFields({ profilePic: uploadedUrl });
          setProfilePictureUrl(uploadedUrl);
          setSelectedProfilePictureFile(null);
          setProfilePicturePreview(null);
          setActiveModal(null);
          return;
        } catch (error) {
          console.error("Profile picture upload error", error);
          setErrorMessage("Unable to upload profile picture. Please try again.");
        } finally {
          setIsSaving(false);
        }

        return;
      }

      const trimmedUrl = profilePictureUrl.trim();
      if (!trimmedUrl) {
        setErrorMessage("Please choose an image or enter a profile picture URL.");
        return;
      }

      await saveProfileFields({ profilePic: trimmedUrl });
      setSelectedProfilePictureFile(null);
      setProfilePicturePreview(null);
      setActiveModal(null);
      return;
    }

    setActiveModal(null);
  };

  const handleLogout = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      await logout();
      window.localStorage.removeItem("metoyou-profile");
      navigate("/login");
    } catch (error) {
      console.error("Logout error", error);
      setErrorMessage("Unable to logout. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pb-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 mb-8">
          <div className="inline-flex items-center gap-3 rounded-full bg-white/30 backdrop-blur-2xl border border-white/50 px-4 py-2 shadow-xl text-sm font-semibold text-slate-700">
            <Sparkles className="w-4 h-4" />
            Premium settings for your MeToYou experience
          </div>

          <div className="grid gap-4">
            <div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-950">Settings <span aria-hidden>⚙️</span></h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-7">
                A liquid glass control center crafted for family, community and style.
                Swipe through your profile, security, display and support options with ease.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-pink-500/15 text-pink-600">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Profile & Personal Details</p>
                  <h2 className="text-2xl font-bold text-slate-900">Your personal control panel</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => openModal("name")}
                className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Name</p>
                    <p className="text-sm text-slate-500">{name}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => openModal("username")}
                className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 text-white">
                    <AtSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Username</p>
                    <p className="text-sm text-slate-500">@{username.toLowerCase()}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <button
                type="button"
                onClick={() => openModal("picture")}
                className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-pink-500 to-purple-500 text-white">
                    <Image className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Profile Picture</p>
                    <p className="text-sm text-slate-500">{profilePictureUrl ? "Custom avatar set" : "Add or change photo"}</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-blue-500/15 text-blue-700">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Password & Security</p>
                  <h2 className="text-2xl font-bold text-slate-900">Keep your account safe</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Change Password</p>
                    <p className="text-sm text-slate-500">Update your login key</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 text-white">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Security Check</p>
                    <p className="text-sm text-slate-500">Review your account protection</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-pink-500 to-purple-500 text-white">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Add / Change Phone Number</p>
                    <p className="text-sm text-slate-500">Two-factor and recovery support</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-blue-500 to-purple-500 text-white">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Add / Change Email</p>
                    <p className="text-sm text-slate-500">Manage your account address</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-slate-800/10 text-slate-900">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Your Information & Permissions</p>
                  <h2 className="text-2xl font-bold text-slate-900">A thoughtful experience coming soon</h2>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-dashed border-white/40 bg-white/10 p-10 text-center text-slate-700">
              <p className="text-2xl font-semibold">Coming Soon 🚧</p>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                We’re crafting a premium permissions hub for your privacy and access controls.
              </p>
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-pink-500/15 text-pink-700">
                  <Monitor className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Display Settings</p>
                  <h2 className="text-2xl font-bold text-slate-900">Theme & visual polish</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => openModal("language")}
                className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30"
              >
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
                    <Flag className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Language</p>
                    <p className="text-sm text-slate-500">
                      {language === "en-basic" ? "English — Basic" : language === "en-street" ? "English — Street" : "French — France"}
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>

              <div className="rounded-3xl border border-white/40 bg-white/15 p-5 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-semibold text-slate-900">Theme</p>
                    <p className="text-sm text-slate-500">Current selected appearance</p>
                  </div>
                  <span className="rounded-full bg-slate-950/10 px-4 py-2 text-sm font-semibold text-slate-900 uppercase tracking-[0.15em]">
                    {selectedTheme === "black-ice" ? "Black Ice" : "Pink Liquid Glass Glow"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTheme("black-ice")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      selectedTheme === "black-ice"
                        ? "border-slate-900 bg-slate-950/10"
                        : "border-white/40 bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">Black Ice</p>
                    <p className="text-sm text-slate-500 mt-1">Dark theme preview</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedTheme("pink-glow")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      selectedTheme === "pink-glow"
                        ? "border-slate-900 bg-slate-950/10"
                        : "border-white/40 bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <p className="font-semibold text-slate-900">Pink Liquid Glass Glow</p>
                    <p className="text-sm text-slate-500 mt-1">Light theme preview</p>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-purple-500/15 text-purple-700">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Help</p>
                  <h2 className="text-2xl font-bold text-slate-900">Support whenever you need it</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                { label: "Help Center", icon: LifeBuoy },
                { label: "Support", icon: HelpCircle },
                { label: "Report A Problem", icon: Flag },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 text-white">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-slate-900">{item.label}</span>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-500" />
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-blue-500/15 text-blue-700">
                  <Info className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">About</p>
                  <h2 className="text-2xl font-bold text-slate-900">Learn more about MeToYou</h2>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 text-white">
                    <Info className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-slate-900">About MeToYou</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>
              <button className="w-full flex items-center justify-between gap-4 rounded-3xl border border-white/40 bg-white/15 px-5 py-4 text-left shadow-lg transition hover:bg-white/30">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500 via-blue-500 to-pink-500 text-white">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-slate-900">Developer/Admin Dashboard</span>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-500" />
              </button>
              <div className="rounded-3xl border border-white/40 bg-white/15 px-5 py-4 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid place-items-center w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-pink-500 to-purple-500 text-white">
                      <Info className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">MeToYou Version</p>
                      <p className="text-sm text-slate-500">Current application build</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-slate-900">Version 1.0.0</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="grid place-items-center w-12 h-12 rounded-3xl bg-red-500/15 text-red-700">
                  <LogOut className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Logout</p>
                  <h2 className="text-2xl font-bold text-slate-900">Exit your MeToYou session</h2>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openModal("logout")}
              className="w-full rounded-3xl bg-red-500/20 border border-red-300 text-red-700 px-6 py-4 text-lg font-semibold shadow-xl transition hover:bg-red-500/30"
            >
              Logout
            </button>
          </section>
        </div>
      </div>

      {activeModal && activeModal !== "logout" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative w-full max-w-xl rounded-[32px] border border-white/30 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Edit</p>
                <h3 className="text-3xl font-bold text-slate-950">
                  {activeModal === "name" && "Update Name"}
                  {activeModal === "username" && "Update Username"}
                  {activeModal === "picture" && "Update Profile Picture"}
                  {activeModal === "language" && "Choose Language"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-full bg-slate-100 p-3 text-slate-700 transition hover:bg-slate-200"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">
              {(activeModal === "name" || activeModal === "username") && (
                <label className="grid gap-3 text-slate-700">
                  <span className="font-semibold">{activeModal === "name" ? "Name" : "Username"}</span>
                  <input
                    value={activeModal === "name" ? name : username}
                    onChange={(event) => {
                      if (activeModal === "name") setName(event.target.value);
                      else setUsername(event.target.value);
                    }}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-pink-500"
                  />
                </label>
              )}

              {activeModal === "picture" && (
                <div className="grid gap-4 text-slate-700">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePictureFile}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-3xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm font-semibold text-pink-600 transition hover:bg-pink-100"
                  >
                    📷 Choose from gallery
                  </button>

                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    disabled={isSaving}
                    className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    🧹 Remove current photo
                  </button>

                  {profilePicturePreview && (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-sm font-semibold text-slate-800">Preview</p>
                      <img
                        src={profilePicturePreview}
                        alt="Profile preview"
                        className="mx-auto h-36 w-36 rounded-3xl object-cover shadow-sm"
                      />
                    </div>
                  )}

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">Or use an image URL</p>
                    <input
                      value={profilePictureUrl}
                      onChange={(event) => setProfilePictureUrl(event.target.value)}
                      placeholder="https://..."
                      className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-pink-500"
                    />
                  </div>
                </div>
              )}

              {activeModal === "language" && (
                <div className="grid gap-3">
                  {[
                    { label: "Basic English", value: "en-basic" },
                    { label: "Street Slang", value: "en-street" },
                    { label: "French", value: "fr-fr" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleLanguageSelection(option.value as AppLanguage)}
                      className={`w-full rounded-3xl border px-5 py-4 text-left text-slate-900 transition hover:bg-slate-100 ${
                        language === option.value ? "border-slate-900 bg-slate-100" : "border-white/40 bg-white/15"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}

              {(errorMessage || statusMessage) && (
                <div className="rounded-3xl border px-4 py-3 text-sm text-slate-700 bg-slate-50">
                  {errorMessage ? (
                    <p className="text-red-600">{errorMessage}</p>
                  ) : (
                    <p className="text-green-600">{statusMessage}</p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row justify-end">
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="rounded-3xl border border-slate-300 px-5 py-3 text-slate-700 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleModalSave}
                  disabled={isSaving}
                  className="rounded-3xl bg-gradient-to-r from-pink-500 to-purple-500 px-5 py-3 text-white font-semibold shadow-lg transition hover:scale-[1.01] disabled:opacity-50"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeModal === "logout" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActiveModal(null)}></div>
          <div className="relative w-full max-w-md rounded-[32px] border border-white/30 bg-white/95 p-6 shadow-2xl backdrop-blur-2xl">
            <div className="mb-5">
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Confirm Logout</p>
              <h3 className="mt-3 text-3xl font-bold text-slate-950">Are you sure you want to logout?</h3>
            </div>
            <p className="text-slate-600 leading-7">Logging out will close your session and return you to the login screen.</p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-3xl border border-slate-300 px-5 py-3 text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-3xl bg-red-500 text-white px-5 py-3 font-semibold shadow-lg transition hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
