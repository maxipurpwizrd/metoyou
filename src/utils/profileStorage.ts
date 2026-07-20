import { normalizeLanguage } from "../lib/i18n";
export type { ProfileData } from "../types/profile";
import type { ProfileData } from "../types/profile";

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

export function mergeProfileWithExisting(
  existingProfile: Partial<ProfileData> | null | undefined,
  incomingProfile: Partial<ProfileData> | null | undefined
): ProfileData {
  const baseProfile = existingProfile && typeof existingProfile === "object" ? existingProfile : DEFAULT_PROFILE;
  const incoming = incomingProfile && typeof incomingProfile === "object" ? incomingProfile : {};

  return {
    ...DEFAULT_PROFILE,
    ...baseProfile,
    ...incoming,
    is_vibes_pro:
      typeof incoming.is_vibes_pro === "boolean"
        ? incoming.is_vibes_pro
        : typeof baseProfile.is_vibes_pro === "boolean"
          ? baseProfile.is_vibes_pro
          : DEFAULT_PROFILE.is_vibes_pro ?? false,
    vibes_pro:
      typeof incoming.vibes_pro === "boolean"
        ? incoming.vibes_pro
        : typeof baseProfile.vibes_pro === "boolean"
          ? baseProfile.vibes_pro
          : DEFAULT_PROFILE.vibes_pro ?? false,
    language: normalizeLanguage(incoming.language ?? baseProfile.language ?? DEFAULT_PROFILE.language),
  } as ProfileData;
}

export function getProfile(): ProfileData {
  return DEFAULT_PROFILE;
}

export function saveProfile(profile: Partial<ProfileData> | null | undefined): ProfileData {
  const normalizedProfile = mergeProfileWithExisting(DEFAULT_PROFILE, profile);
  return normalizedProfile;
}
