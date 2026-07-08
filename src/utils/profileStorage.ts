import { normalizeLanguage } from "../lib/i18n";

export type ProfileData = {
  id: string;
  username: string;
  firstName?: string;
  bio: string;
  profilePic: string | null;
  vibes_pro_portrait?: string | null;
  is_vibes_pro?: boolean;
  vibes_pro?: boolean;
  vibes_pro_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  interests: string[];
  email: string;
  language?: string;
  dateOfBirth?: string;
  gender?: string;
  hommies_count: number;
  snapshots_count: number;
  vibes_count: number;
};

const PROFILE_KEY = "metoyou-profile";

export const DEFAULT_PROFILE: ProfileData = {
  id: "user_001",
  username: "Maxi",
  bio: "Building MeToYou from the ground up.",
  profilePic: null,
  is_vibes_pro: false,
  vibes_pro: false,
  vibes_pro_until: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  interests: [],
  email: "maxi@example.com",
  language: "en-basic",
  dateOfBirth: "",
  gender: "",
  hommies_count: 0,
  snapshots_count: 0,
  vibes_count: 0,
};

export function getProfile(): ProfileData {
  const saved = localStorage.getItem(PROFILE_KEY);
  if (!saved) return DEFAULT_PROFILE;

  try {
    const parsed = JSON.parse(saved) as Partial<ProfileData>;
    return {
      ...DEFAULT_PROFILE,
      ...parsed,
      language: normalizeLanguage(parsed.language),
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: ProfileData): void {
  const normalizedProfile = {
    ...profile,
    language: normalizeLanguage(profile.language),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizedProfile));
}
