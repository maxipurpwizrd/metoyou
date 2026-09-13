import {
  fetchProfileFromSupabase,
  upsertProfileToSupabase,
  fetchProfileByUsername,
  uploadProfileImage,
  searchUsersByUsername,
} from "../../lib/profileApi";

export const userService = {
  fetchProfile: fetchProfileFromSupabase,
  upsertProfile: upsertProfileToSupabase,
  fetchProfileByUsername,
  uploadProfileImage,
  searchUsersByUsername,
};
