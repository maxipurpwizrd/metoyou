import { supabase } from "./supabase";
import { optimizeImageFile, mimeToExtension } from "./imageUtils";
import { normalizeLanguage } from "./i18n";
import type { ProfileData } from "../utils/profileStorage";

const PROFILE_PICTURE_BUCKET = "profile-pictures";

type DbProfile = Omit<ProfileData, "profilePic" | "dateOfBirth" | "gender"> & {
  profile_pic: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  vibes_pro?: boolean | null;
  vibes_pro_portrait?: string | null;
  vibes_pro_until?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
};

export async function fetchProfileFromSupabase(userId?: string) {
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

    const result = data as DbProfile;
    return {
      ...result,
      profilePic: typeof result.profile_pic === "string" ? result.profile_pic : null,
      vibes_pro_portrait: typeof result.vibes_pro_portrait === "string" ? result.vibes_pro_portrait : null,
      interests: Array.isArray(result.interests) ? result.interests : [],
      dateOfBirth: result.date_of_birth ?? undefined,
      gender: result.gender ?? undefined,
    } as ProfileData;
  } catch (e) {
    console.error("fetchProfileFromSupabase error", e);
    return null;
  }
}

export async function upsertProfileToSupabase(profile: ProfileData) {
  try {
    const normalizedLanguage = normalizeLanguage(profile.language);
    const { profilePic, dateOfBirth, gender } = profile;
    const dbProfile = {
      id: profile.id,
      username: profile.username,
      bio: profile.bio ?? "",
      email: profile.email ?? "",
      profile_pic: profilePic ?? profile.vibes_pro_portrait ?? null,
      date_of_birth: dateOfBirth ?? null,
      gender: gender ?? null,
      vibes_pro: Boolean(profile.vibes_pro ?? profile.is_vibes_pro),
      vibes_pro_portrait: profile.vibes_pro_portrait ?? null,
      vibes_pro_until: profile.vibes_pro_until ?? null,
      stripe_customer_id: profile.stripe_customer_id ?? null,
      stripe_subscription_id: profile.stripe_subscription_id ?? null,
      interests: profile.interests ?? [],
      language: normalizedLanguage,
      hommies_count: profile.hommies_count ?? 0,
      snapshots_count: profile.snapshots_count ?? 0,
      vibes_count: profile.vibes_count ?? 0,
    } as DbProfile;

    const { data, error } = await supabase.from("profiles").upsert(dbProfile).select().maybeSingle();
    if (error) throw error;

    if (!data) return null;

    const result = data as DbProfile;
    return {
      ...result,
      profilePic: typeof result.profile_pic === "string" ? result.profile_pic : null,
      vibes_pro_portrait: typeof result.vibes_pro_portrait === "string" ? result.vibes_pro_portrait : null,
      is_vibes_pro: Boolean(result.vibes_pro ?? result.is_vibes_pro),
      vibes_pro: Boolean(result.vibes_pro ?? result.is_vibes_pro),
      vibes_pro_until: result.vibes_pro_until ?? null,
      stripe_customer_id: result.stripe_customer_id ?? null,
      stripe_subscription_id: result.stripe_subscription_id ?? null,
      dateOfBirth: result.date_of_birth ?? undefined,
      gender: result.gender ?? undefined,
    } as ProfileData;
  } catch (e) {
    console.error("upsertProfileToSupabase error", e);
    return null;
  }
}

export async function fetchProfileByUsername(username?: string) {
  try {
    if (!username) return null;

    const { data, error } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const result = data as DbProfile;
    return {
      ...result,
      profilePic: typeof result.profile_pic === "string" ? result.profile_pic : null,
      vibes_pro_portrait: typeof result.vibes_pro_portrait === "string" ? result.vibes_pro_portrait : null,
      interests: Array.isArray(result.interests) ? result.interests : [],
      dateOfBirth: result.date_of_birth ?? undefined,
      gender: result.gender ?? undefined,
    } as ProfileData;
  } catch (e) {
    console.error("fetchProfileByUsername error", e);
    return null;
  }
}

export async function uploadProfileImage(file: File) {
  try {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id;
    if (!userId) return null;

    // Optimize image before upload
    const optimized = await optimizeImageFile(file, 1200, 0.8);
    const ext = mimeToExtension(optimized.type || file.type || "image/jpeg");
    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(PROFILE_PICTURE_BUCKET).upload(filename, optimized, {
      contentType: optimized.type || file.type,
    } as any);
    if (error) throw error;

    const { data: urlData } = supabase.storage.from(PROFILE_PICTURE_BUCKET).getPublicUrl(filename);
    return urlData.publicUrl ?? null;
  } catch (e) {
    console.error("uploadProfileImage error", e);
    return null;
  }
}

export async function searchUsersByUsername(query: string) {
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

    return (data || []).map((item: any) => ({
      id: item.id,
      username: item.username,
      profilePic: item.profile_pic,
    }));
  } catch (e) {
    console.error("searchUsersByUsername error", e);
    return [];
  }
}
