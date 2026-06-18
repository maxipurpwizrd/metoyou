export type ProfileData = {
  id: string;
  username: string;
  bio: string;
  profilePic: string | null;
  interests: string[];
  email: string;
  language?: string;
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
  interests: [],
  email: "maxi@example.com",
  language: "English",
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
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: ProfileData): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
