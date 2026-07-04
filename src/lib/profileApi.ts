import { supabase } from "./supabase";
import { normalizeLanguage } from "./i18n";
import type { ProfileData } from "../utils/profileStorage";

type DbProfile = Omit<ProfileData, "profilePic"> & {
  profile_pic: string | null;
  first_name?: string | null;
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
      profilePic: result.profile_pic,
      interests: Array.isArray(result.interests) ? result.interests : [],
    } as ProfileData;
  } catch (e) {
    console.error("fetchProfileFromSupabase error", e);
    return null;
  }
}

export async function upsertProfileToSupabase(profile: ProfileData) {
  try {
    const normalizedLanguage = normalizeLanguage(profile.language);
    const { profilePic, firstName, ...rest } = profile;
    const dbProfile = {
      ...rest,
      first_name: firstName ?? null,
      language: normalizedLanguage,
      interests: profile.interests ?? [],
      profile_pic: profilePic,
    } as DbProfile;

    const { data, error } = await supabase.from("profiles").upsert(dbProfile).select().maybeSingle();
    if (error) throw error;

    if (!data) return null;

    const result = data as DbProfile;
    return {
      ...result,
      profilePic: result.profile_pic,
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
      profilePic: result.profile_pic,
      interests: Array.isArray(result.interests) ? result.interests : [],
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

    const timestamp = Date.now();
    const filename = `${userId}/${timestamp}_${file.name}`;
    const { error } = await supabase.storage.from("profile-avatars").upload(filename, file, {
      contentType: file.type,
    });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from("profile-avatars").getPublicUrl(filename);
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
