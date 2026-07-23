import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "../hooks/useAuth";
import { fetchProfileFromSupabase } from "../lib/profileApi";
import { normalizeLanguage, type AppLanguage, DEFAULT_LANGUAGE } from "../lib/i18n";
import { isVibesProEnabled } from "../lib/vibesPro";
import type { ProfileData } from "../types/profile";

const SESSION_CACHE_KEY = "metoyou-session-cache";

type SessionContextValue = {
  authUser: User | null;
  profile: ProfileData | null;
  isLoadingSession: boolean;
  isAuthenticated: boolean;
  isVibesPro: boolean;
  language: AppLanguage;
  profileReady: boolean;
  setProfile: (profile: ProfileData | null) => void;
  setLanguage: (language: AppLanguage) => void;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

function canonicalizeProfile(profile: Partial<ProfileData> | null | undefined): ProfileData | null {
  if (!profile) return null;

  const isVibesPro = isVibesProEnabled(profile);

  return {
    ...profile,
    id: profile.id ?? "",
    username: profile.username ?? "",
    bio: profile.bio ?? "",
    profilePic: profile.profilePic ?? null,
    vibes_pro_portrait: profile.vibes_pro_portrait ?? null,
    is_vibes_pro: isVibesPro,
    vibes_pro: isVibesPro,
    vibes_pro_until: profile.vibes_pro_until ?? null,
    stripe_customer_id: profile.stripe_customer_id ?? null,
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
    interests: Array.isArray(profile.interests) ? profile.interests : [],
    email: profile.email ?? "",
    language: normalizeLanguage(profile.language ?? DEFAULT_LANGUAGE),
    dateOfBirth: profile.dateOfBirth ?? "",
    gender: profile.gender ?? "",
    hommies_count: profile.hommies_count ?? 0,
    snapshots_count: profile.snapshots_count ?? 0,
    vibes_count: profile.vibes_count ?? 0,
  } as ProfileData;
}

function readSessionCache(): { profile: ProfileData | null; language: AppLanguage } | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { profile?: ProfileData | null; language?: AppLanguage };
    const cached = {
      profile: canonicalizeProfile(parsed.profile ?? null),
      language: normalizeLanguage(parsed.language ?? DEFAULT_LANGUAGE),
    };
    if (cached.profile) {
      console.log("[Session] Using cached profile", { profileId: cached.profile.id });
    }
    return cached;
  } catch {
    return null;
  }
}

function writeSessionCache(profile: ProfileData | null, language: AppLanguage) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      SESSION_CACHE_KEY,
      JSON.stringify({ profile: profile ? canonicalizeProfile(profile) : null, language })
    );
  } catch {
    // Ignore cache write errors and keep the app usable.
  }
}

let setGlobalSessionProfile: ((profile: ProfileData | null) => void) | null = null;

function clearCachedPremiumState() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem("metoyou-feed-cache");
  } catch {
    // ignore cache clearing errors
  }

  try {
    const keysToRemove = Object.keys(window.sessionStorage).filter((key) =>
      key.startsWith("metoyou-profile:") || key.startsWith("metoyou-profile-posts:")
    );
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // ignore cache clearing errors
  }
}

export function setGlobalProfile(profile: ProfileData | null) {
  setGlobalSessionProfile?.(profile);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [profile, setProfileState] = useState<ProfileData | null>(() => {
    const cached = readSessionCache();
    return cached?.profile ?? null;
  });
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    const cached = readSessionCache();
    return normalizeLanguage(cached?.language ?? DEFAULT_LANGUAGE);
  });
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [profileReady, setProfileReady] = useState(false);
  const lastRefreshAtRef = useRef(0);
  const refreshInFlightRef = useRef(false);
  const userRef = useRef<User | null>(user);
  const profileRef = useRef<ProfileData | null>(profile);
  const languageRef = useRef<AppLanguage>(language);
  const hasLoadedProfileRef = useRef(false);
  const prevUserIdRef = useRef<string | null | undefined>(user?.id);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const setProfile = useCallback((nextProfile: ProfileData | null) => {
    const canonicalProfile = canonicalizeProfile(nextProfile);
    setProfileState(canonicalProfile);
    console.log("[Session] Session profile updated", { profileId: canonicalProfile?.id });
    if (canonicalProfile) {
      const nextLanguage = normalizeLanguage(canonicalProfile.language ?? languageRef.current);
      setLanguageState(nextLanguage);
      writeSessionCache(canonicalProfile, nextLanguage);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = canonicalProfile.is_vibes_pro ? "vibespro" : "default";
      }
      return;
    }

    writeSessionCache(null, languageRef.current);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = "default";
    }
  }, []);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("metoyou-language", normalized);
    }
    writeSessionCache(profileRef.current, normalized);
  }, []);

  const refreshSession = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return;
    }

    const now = Date.now();
    const currentProfile = profileRef.current;
    const currentUserId = userRef.current?.id;

    if (now - lastRefreshAtRef.current < 15_000 && currentProfile?.id) {
      return;
    }
    lastRefreshAtRef.current = now;

    if (!currentUserId) {
      hasLoadedProfileRef.current = true;
      setProfileState(null);
      setProfileReady(true);
      setIsLoadingSession(false);
      writeSessionCache(null, languageRef.current);
      return;
    }

    refreshInFlightRef.current = true;
    setIsLoadingSession(true);
    if (!hasLoadedProfileRef.current) {
      setProfileReady(false);
    }

    try {
      const remoteProfile = await fetchProfileFromSupabase(currentUserId);
      const nextProfile = canonicalizeProfile(remoteProfile);
      const premiumChanged = Boolean(currentProfile?.is_vibes_pro) !== Boolean(nextProfile?.is_vibes_pro);
      setProfileState(nextProfile);
      console.log("[Session] Supabase profile loaded", { profileId: nextProfile?.id, isVibesPro: nextProfile?.is_vibes_pro, premiumChanged });

      if (premiumChanged) {
        clearCachedPremiumState();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("metoyou:profile-refresh"));
        }
      }

      if (nextProfile) {
        const nextLanguage = normalizeLanguage(nextProfile.language ?? languageRef.current);
        setLanguageState(nextLanguage);
        writeSessionCache(nextProfile, nextLanguage);
        if (typeof document !== "undefined") {
          document.documentElement.dataset.theme = nextProfile.is_vibes_pro ? "vibespro" : "default";
        }
      } else {
        writeSessionCache(null, languageRef.current);
      }

      setProfileReady(true);
      hasLoadedProfileRef.current = true;
    } catch {
      const cached = readSessionCache();
      const fallbackProfile = canonicalizeProfile(cached?.profile ?? null);
      setProfileState(fallbackProfile);
      if (fallbackProfile) {
        const fallbackLanguage = normalizeLanguage(fallbackProfile.language ?? languageRef.current);
        setLanguageState(fallbackLanguage);
        writeSessionCache(fallbackProfile, fallbackLanguage);
      }
      setProfileReady(true);
      hasLoadedProfileRef.current = true;
    } finally {
      refreshInFlightRef.current = false;
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    setGlobalSessionProfile = setProfile;
    if (typeof window !== "undefined") {
      (window as Window & { __metoyouSessionSetter?: typeof setProfile }).__metoyouSessionSetter = setProfile;
    }
    return () => {
      setGlobalSessionProfile = null;
      if (typeof window !== "undefined") {
        delete (window as Window & { __metoyouSessionSetter?: typeof setProfile }).__metoyouSessionSetter;
      }
    };
  }, [profile, language, setProfile]);

  useEffect(() => {
    const currentUserId = user?.id;
    if (prevUserIdRef.current !== currentUserId) {
      hasLoadedProfileRef.current = false;
      prevUserIdRef.current = currentUserId;
    }

    if (authLoading) {
      setIsLoadingSession(true);
      setProfileReady(false);
      return;
    }

    void refreshSession();
  }, [authLoading, refreshSession, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleFocus = () => {
      void refreshSession();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshSession();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      authUser: user ?? null,
      profile,
      isLoadingSession,
      isAuthenticated: Boolean(user),
      isVibesPro: isVibesProEnabled(profile),
      language,
      profileReady,
      setProfile,
      setLanguage,
      refreshSession,
    }),
    [user, profile, isLoadingSession, profileReady, language, setProfile, setLanguage, refreshSession]
  );

  console.log("[Session] Rendering with profile id:", profile?.id);
  console.log("[Session] isVibesPro:", isVibesProEnabled(profile));

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
