import type { PostRecord } from "../../types/post";
import { normalizeNativeVibesProEntitlement, type NativeVibesProEntitlement } from "./entitlement";
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
  followerCount: number;
  followingCount: number;
};

export type NativeConnectionTab = "friends" | "following" | "followers";

export async function fetchNativeVibesProEntitlement(userId: string): Promise<NativeVibesProEntitlement> {
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
    vibes_pro_until?: string | null;
  };
  return normalizeNativeVibesProEntitlement(profile);
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

export async function fetchNativeProfilePosts(
  authorId: string,
  viewerId: string,
  authorProfile?: NativeProfile | null,
): Promise<PostRecord[]> {
  const { data, error } = await nativeSupabase
    .from("posts")
    .select("id, author_id, text, image_url, image_original_url, video_url, audio_url, content_kind, likes_count, comments_count, highlighted, created_at")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  const posts = (data ?? []) as PostRecord[];
  if (posts.length === 0) return posts;

  let author = authorProfile;
  if (author === undefined) {
    const { data, error: profilesError } = await nativeSupabase
      .from("public_profiles")
      .select("*")
      .eq("id", authorId)
      .maybeSingle();
    if (profilesError) throw profilesError;
    author = data as NativeProfile | null;
  }

  const { data: likes, error: likesError } = await nativeSupabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", viewerId)
    .in("post_id", posts.map((post) => post.id));
  if (likesError) throw likesError;

  const likedIds = new Set((likes ?? []).map((like) => like.post_id));
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
  const [
    { data: followsProfile, error: followsProfileError },
    { data: profileFollowsViewer, error: profileFollowsViewerError },
    { count: followerCount, error: followerCountError },
    { count: followingCount, error: followingCountError },
  ] = await Promise.all([
    nativeSupabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", viewerId)
      .eq("following_id", profileId)
      .maybeSingle(),
    nativeSupabase
      .from("followers")
      .select("follower_id")
      .eq("follower_id", profileId)
      .eq("following_id", viewerId)
      .maybeSingle(),
    nativeSupabase
      .from("followers")
      .select("follower_id", { count: "exact", head: true })
      .eq("following_id", profileId),
    nativeSupabase
      .from("followers")
      .select("following_id", { count: "exact", head: true })
      .eq("follower_id", profileId),
  ]);
  if (followsProfileError) throw followsProfileError;
  if (profileFollowsViewerError) throw profileFollowsViewerError;
  if (followerCountError) throw followerCountError;
  if (followingCountError) throw followingCountError;

  return {
    isFollowing: Boolean(followsProfile),
    isFollowedBy: Boolean(profileFollowsViewer),
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
  };
}

export async function fetchNativeConnections(
  profileId: string,
  tab: NativeConnectionTab,
): Promise<NativeProfileConnection[]> {
  const [followersResult, followingResult] = await Promise.all([
    tab === "following"
      ? Promise.resolve(null)
      : nativeSupabase
          .from("followers")
          .select("follower_id, created_at")
          .eq("following_id", profileId)
          .order("created_at", { ascending: false }),
    tab === "followers"
      ? Promise.resolve(null)
      : nativeSupabase
          .from("followers")
          .select("following_id, created_at")
          .eq("follower_id", profileId)
          .order("created_at", { ascending: false }),
  ]);
  if (followersResult?.error) throw followersResult.error;
  if (followingResult?.error) throw followingResult.error;

  const followerIds = [...new Set((followersResult?.data ?? []).map((row) => row.follower_id as string))];
  const followingIds = [...new Set((followingResult?.data ?? []).map((row) => row.following_id as string))];
  const followingIdSet = new Set(followingIds);
  const ids = tab === "friends"
    ? followerIds.filter((id) => followingIdSet.has(id))
    : tab === "followers"
      ? followerIds
      : followingIds;
  if (!ids.length) return [];

  const { data, error } = await nativeSupabase
    .from("public_profiles")
    .select("id, username, profile_pic")
    .in("id", ids);
  if (error) throw error;

  const profileById = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return ids.flatMap((id) => {
    const profile = profileById.get(id);
    return profile ? [{
      id: profile.id,
      username: profile.username ?? profile.id,
      profile_pic: profile.profile_pic ?? null,
    }] : [];
  });
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
