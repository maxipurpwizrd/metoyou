import type { ProfileData } from "../types/profile";

export function isVibesProEnabled(profile?: Partial<ProfileData> | null): boolean {
  return Boolean(profile?.is_vibes_pro ?? profile?.vibes_pro ?? false);
}

export function normalizeVibesProProfile<T extends Partial<ProfileData> | null | undefined>(profile: T): T {
  if (!profile) return profile;

  return {
    ...profile,
    is_vibes_pro: isVibesProEnabled(profile),
    vibes_pro: isVibesProEnabled(profile),
  } as T;
}
