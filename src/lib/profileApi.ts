import { supabase } from "./supabase";
import { optimizeImageFile, mimeToExtension } from "./imageUtils";
import { normalizeLanguage } from "./i18n";
import type { DbProfile, ProfileData, ProfileSearchResult } from "../types/profile";

const PROFILE_PICTURE_BUCKET = "profile-pictures";

function normalizeProfileRecord(result: DbProfile): ProfileData {
  // Some rows may have `is_vibes_pro` or `vibes_pro` set (legacy vs canonical).
  // Treat the user as VibesPro if either flag is explicitly true. Avoid using
  // nullish coalescing which would let an explicit `false` on one field shadow
  // a `true` on the other.
  const isVibesPro = Boolean(result.vibes_pro || result.is_vibes_pro);

  return {
    ...result,
    profilePic: typeof result.profile_pic === "string" ? result.profile_pic : null,
    vibes_pro_portrait: typeof result.vibes_pro_portrait === "string" ? result.vibes_pro_portrait : null,
    interests: Array.isArray(result.interests) ? result.interests : [],
    dateOfBirth: result.date_of_birth ?? undefined,
    gender: result.gender ?? undefined,
    is_vibes_pro: isVibesPro,
    vibes_pro: isVibesPro,
    vibes_pro_until: result.vibes_pro_until ?? null,
    stripe_customer_id: result.stripe_customer_id ?? null,
    stripe_subscription_id: result.stripe_subscription_id ?? null,
  } as ProfileData;
}

export async function fetchProfileFromSupabase(userId?: string): Promise<ProfileData | null> {
  try {
    let id = userId;
    if (!id) {
      const { data } = await supabase.auth.getUser();
      id = data?.user?.id;
    }

    if (!id) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;

    if (!data) return null;

    return normalizeProfileRecord(data as DbProfile);
  } catch (e) {
    console.error("fetchProfileFromSupabase error", e);
    return null;
  }
}

export async function upsertProfileToSupabase(profile: ProfileData): Promise<ProfileData | null> {
  try {
    const { data: existingProfileRow, error: currentProfileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", profile.id)
      .maybeSingle();

    if (currentProfileError && currentProfileError.code !== "PGRST116") {
      throw currentProfileError;
    }

    const existingProfile = (existingProfileRow as DbProfile | null) ?? null;
    const normalizedLanguage = normalizeLanguage(profile.language ?? existingProfile?.language ?? undefined);
    const { profilePic, dateOfBirth, gender } = profile;
    const vibesProValue = typeof profile.vibes_pro === "boolean"
      ? profile.vibes_pro
      : typeof profile.is_vibes_pro === "boolean"
        ? profile.is_vibes_pro
        : Boolean(existingProfile?.vibes_pro ?? existingProfile?.is_vibes_pro ?? false);
    const dbProfile = {
      id: profile.id,
      username: profile.username ?? existingProfile?.username ?? "",
      bio: profile.bio ?? existingProfile?.bio ?? "",
      email: profile.email ?? existingProfile?.email ?? "",
      profile_pic: profilePic ?? profile.vibes_pro_portrait ?? existingProfile?.profile_pic ?? null,
      date_of_birth: dateOfBirth ?? existingProfile?.date_of_birth ?? null,
      gender: gender ?? existingProfile?.gender ?? null,
      vibes_pro: vibesProValue,
      vibes_pro_portrait: profile.vibes_pro_portrait ?? existingProfile?.vibes_pro_portrait ?? null,
      vibes_pro_until: profile.vibes_pro_until ?? existingProfile?.vibes_pro_until ?? null,
      stripe_customer_id: profile.stripe_customer_id ?? existingProfile?.stripe_customer_id ?? null,
      stripe_subscription_id: profile.stripe_subscription_id ?? existingProfile?.stripe_subscription_id ?? null,
      interests: profile.interests ?? existingProfile?.interests ?? [],
      language: normalizedLanguage,
      hommies_count: profile.hommies_count ?? existingProfile?.hommies_count ?? 0,
      snapshots_count: profile.snapshots_count ?? existingProfile?.snapshots_count ?? 0,
      vibes_count: profile.vibes_count ?? existingProfile?.vibes_count ?? 0,
    } as DbProfile;

    console.log("[trace][profileApi] request payload", {
      operation: "upsert",
      payload: dbProfile,
      hasId: Boolean(dbProfile.id),
      hasUserId: Boolean((dbProfile as any).user_id),
      isVibesPro: dbProfile.vibes_pro,
      language: dbProfile.language,
    });

    const { data, error } = await supabase.from("profiles").upsert(dbProfile).select().maybeSingle();
    console.log("[trace][profileApi] response", {
      error,
      data,
      dataIsVibesPro: (data as DbProfile | null | undefined)?.vibes_pro,
      dataLanguage: (data as DbProfile | null | undefined)?.language,
    });
    if (error) throw error;

    if (!data) return null;

    return normalizeProfileRecord(data as DbProfile);
  } catch (e) {
    console.error("upsertProfileToSupabase error", e);
    return null;
  }
}

export async function fetchProfileByUsername(username?: string): Promise<ProfileData | null> {
  try {
    if (!username) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return normalizeProfileRecord(data as DbProfile);
  } catch (e) {
    console.error("fetchProfileByUsername error", e);
    return null;
  }
}

export async function uploadProfileImage(file: File): Promise<string | null> {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id;
    if (!userId) return null;

    // Optimize image before upload
    const optimized = await optimizeImageFile(file, 1200, 0.8);
    const ext = mimeToExtension(optimized.type || file.type || "image/jpeg");
    const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(PROFILE_PICTURE_BUCKET).upload(filePath, optimized, {
      contentType: optimized.type || file.type,
      upsert: false,
    });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from(PROFILE_PICTURE_BUCKET).getPublicUrl(filePath);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadProfileImage error", e);
    return null;
  }
}

export async function searchUsersByUsername(query: string): Promise<ProfileSearchResult[]> {
  try {
    if (!query.trim()) {
      return [];
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, profile_pic")
      .ilike("username", `%${query}%`)
      .limit(20);

    if (error) throw error;

    return (data ?? []).map((item) => ({
      id: item.id,
      username: item.username,
      profilePic: item.profile_pic,
    }));
  } catch (e) {
    console.error("searchUsersByUsername error", e);
    return [];
  }
}
