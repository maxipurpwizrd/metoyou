import type { PostRecord } from "../../types/post";
import { nativeSupabase } from "./supabase";

export type NativeProfile = {
  id: string;
  username: string;
  email?: string | null;
  bio?: string | null;
  profile_pic?: string | null;
  profile_original_pic?: string | null;
  vibes_pro_portrait?: string | null;
  is_vibes_pro?: boolean | null;
  is_vibespro?: boolean | null;
  vibes_pro?: boolean | null;
  interests?: string[] | null;
  hommies_count?: number | null;
  snapshots_count?: number | null;
  vibes_count?: number | null;
};

export type NativeProfileConnection = {
  id: string;
  username: string;
  profile_pic: string | null;
};

export type NativeFollowInfo = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  hommies: NativeProfileConnection[];
};

export async function fetchNativeVibesProStatus(userId: string): Promise<boolean> {
  const { data, error } = await nativeSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Your profile could not be found.");

  const profile = data as {
    is_vibes_pro?: boolean | null;
    is_vibespro?: boolean | null;
    vibes_pro?: boolean | null;
  };
  return profile.is_vibes_pro ?? profile.is_vibespro ?? profile.vibes_pro ?? false;
}

export async function fetchNativeProfileById(userId: string): Promise<NativeProfile | null> {
  const { data, error } = await nativeSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as NativeProfile | null;
}

export async function fetchNativeProfileByUsername(username: string): Promise<NativeProfile | null> {
  const { data, error } = await nativeSupabase
    .from("public_profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data as NativeProfile | null;
}

export async function fetchNativeProfilePosts(authorId: string, viewerId: string): Promise<PostRecord[]> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, author_id, text, image_url, image_original_url, video_url, audio_url, content_kind, likes_count, comments_count, highlighted, created_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const posts = (data ?? []) as PostRecord[];
  if (posts.length === 0) return posts;

  const { data: authorProfiles, error: profilesError } = await nativeSupabase
    .from("public_profiles")
    .select("*")
    .eq("id", authorId)
    .maybeSingle();
  if (profilesError) throw profilesError;

  const { data: likes, error: likesError } = await nativeSupabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", posts.map((post) => post.id));
  if (likesError) throw likesError;

  const likedIds = new Set((likes ?? []).map((like) => like.post_id));
  const author = authorProfiles as NativeProfile | null;
  return posts.map((post) => ({
    ...post,
    profiles: author
      ? {
          username: author.username,
          profile_pic: author.profile_pic ?? null,
          is_vibes_pro: author.is_vibes_pro ?? null,
          vibes_pro: author.vibes_pro ?? null,
        }
      : null,
    liked: likedIds.has(post.id),
  }));
}

export async function fetchNativeFollowInfo(viewerId: string, profileId: string): Promise<NativeFollowInfo> {
  const [{ data: followers, error: followersError }, { data: following, error: followingError }] = await Promise.all([
    nativeSupabase.from("followers").select("follower_id").eq("following_id", profileId),
    nativeSupabase.from("followers").select("following_id").eq("follower_id", profileId),
  ]);
  if (followersError) throw followersError;
  if (followingError) throw followingError;

  const followerIds = new Set((followers ?? []).map((row) => row.follower_id as string));
  const followingIds = new Set((following ?? []).map((row) => row.following_id as string));
  const mutualIds = [...followerIds].filter((id) => followingIds.has(id));
  let hommies: NativeProfileConnection[] = [];
  if (mutualIds.length > 0) {
    const { data, error } = await nativeSupabase
      .from("public_profiles")
      .select("id, username, profile_pic")
      .in("id", mutualIds);
    if (error) throw error;
    hommies = (data ?? []).map((profile) => ({
      id: profile.id,
      username: profile.username ?? profile.id,
      profile_pic: profile.profile_pic ?? null,
    }));
  }

  return {
    isFollowing: followerIds.has(viewerId),
    isFollowedBy: followingIds.has(viewerId),
    hommies,
  };
}

export async function setNativeFollow(viewerId: string, profileId: string, follow: boolean) {
  const query = follow
    ? nativeSupabase.from("followers").insert({
        follower_id: viewerId,
        following_id: profileId,
        created_at: new Date().toISOString(),
      })
    : nativeSupabase.from("followers").delete().match({
        follower_id: viewerId,
        following_id: profileId,
      });
  const { error } = await query;
  if (error) throw error;
}
