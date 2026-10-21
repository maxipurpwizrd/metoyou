import { nativeSupabase } from "./supabase";

export type NativeSearchUser = {
  id: string;
  username: string;
  profile_pic: string | null;
};

export async function searchNativeUsersByUsername(query: string): Promise<NativeSearchUser[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const { data, error } = await nativeSupabase
    .from("profiles")
    .select("id, username, profile_pic")
    .ilike("username", `%${normalizedQuery}%`)
    .limit(20);

  if (error) throw error;

  return (data ?? []).flatMap((profile) => {
    if (!profile.username) return [];
    return [{
      id: profile.id,
      username: profile.username,
      profile_pic: profile.profile_pic,
    }];
  });
}
