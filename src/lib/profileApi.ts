import { supabase } from "./supabase";
import type { ProfileData } from "../utils/profileStorage";

type DbProfile = Omit<ProfileData, "profilePic"> & {
  profile_pic: string | null;
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
    const { profilePic, ...rest } = profile;
    const dbProfile = {
      ...rest,
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
