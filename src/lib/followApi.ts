import { supabase } from "./supabase";

export type FollowStatus = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  followersCount: number;
};

export type MutualConnection = {
  id: string;
  username: string;
  profilePic?: string | null;
};

export async function getFollowersCount(userId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("followers")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId);

    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    console.error("getFollowersCount error", e);
    return 0;
  }
}

export async function getMutualConnections(userId: string): Promise<MutualConnection[]> {
  try {
    const [{ data: followersData, error: followersError }, { data: followingData, error: followingError }] = await Promise.all([
      supabase.from("followers").select("follower_id").eq("following_id", userId),
      supabase.from("followers").select("following_id").eq("follower_id", userId),
    ]);

    if (followersError) throw followersError;
    if (followingError) throw followingError;

    const followerIds = new Set<string>(
      (followersData ?? [])
        .map((item) => (item as { follower_id?: string | null }).follower_id)
        .filter((value): value is string => Boolean(value))
    );
    const followingIds = new Set<string>(
      (followingData ?? [])
        .map((item) => (item as { following_id?: string | null }).following_id)
        .filter((value): value is string => Boolean(value))
    );

    const mutualIds = Array.from(followerIds).filter((id) => followingIds.has(id));
    if (mutualIds.length === 0) return [];

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, username, profile_pic")
      .in("id", mutualIds);

    if (profilesError) throw profilesError;

    return (profiles ?? []).map((profile) => ({
      id: profile.id,
      username: profile.username ?? profile.id,
      profilePic: profile.profile_pic ?? null,
    }));
  } catch (e) {
    console.error("getMutualConnections error", e);
    return [];
  }
}

export async function getFollowStatus(
  viewerId: string,
  targetId: string
): Promise<FollowStatus> {
  try {
    const [viewerFollowsRes, ownerFollowsRes, followersCount] = await Promise.all([
      supabase
        .from("followers")
        .select("id")
        .match({ follower_id: viewerId, following_id: targetId })
        .maybeSingle(),
      supabase
        .from("followers")
        .select("id")
        .match({ follower_id: targetId, following_id: viewerId })
        .maybeSingle(),
      getFollowersCount(targetId),
    ]);

    if (viewerFollowsRes.error) throw viewerFollowsRes.error;
    if (ownerFollowsRes.error) throw ownerFollowsRes.error;

    return {
      isFollowing: Boolean(viewerFollowsRes.data),
      isFollowedBy: Boolean(ownerFollowsRes.data),
      followersCount,
    };
  } catch (e) {
    console.error("getFollowStatus error", e);
    return {
      isFollowing: false,
      isFollowedBy: false,
      followersCount: 0,
    };
  }
}

export async function followUser(
  viewerId: string,
  targetId: string,
  actorUsername: string
) {
  try {
    const { error: followError } = await supabase.from("followers").insert({
      follower_id: viewerId,
      following_id: targetId,
      created_at: new Date().toISOString(),
    });
    if (followError) throw followError;

    if (actorUsername) {
      const { data: mutualFollowData, error: mutualFollowError } = await supabase
        .from("followers")
        .select("id")
        .match({ follower_id: targetId, following_id: viewerId })
        .maybeSingle();

      if (mutualFollowError) throw mutualFollowError;

      const notificationType = mutualFollowData ? "follow_back" : "follow";
      const message = mutualFollowData ? "followed you back" : "followed you";
      const createdAt = new Date().toISOString();
      const { error: notificationError } = await supabase.from("notifications").insert({
        type: notificationType,
        message,
        target_id: targetId,
        actor_id: viewerId,
        user_id: targetId,
        created_at: createdAt,
        is_read: false,
      });
      if (notificationError) throw notificationError;
    }

    // Recompute followers count and persist to profiles.hommies_count
    try {
      const followersCount = await getFollowersCount(targetId);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ hommies_count: followersCount })
        .eq("id", targetId);
      if (updateError) console.warn("Failed to update profiles.hommies_count", updateError);
    } catch (e) {
      console.warn("Failed to recompute followers count after follow", e);
    }

    return true;
  } catch (e) {
    console.error("followUser error", e);
    return false;
  }
}

export async function unfollowUser(viewerId: string, targetId: string) {
  try {
    const { error } = await supabase
      .from("followers")
      .delete()
      .match({ follower_id: viewerId, following_id: targetId });
    if (error) throw error;
    // Recompute followers count and persist to profiles.hommies_count
    try {
      const followersCount = await getFollowersCount(targetId);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ hommies_count: followersCount })
        .eq("id", targetId);
      if (updateError) console.warn("Failed to update profiles.hommies_count", updateError);
    } catch (e) {
      console.warn("Failed to recompute followers count after unfollow", e);
    }

    return true;
  } catch (e) {
    console.error("unfollowUser error", e);
    return false;
  }
}
