import { supabase } from "./supabase";

export type FollowStatus = {
  isFollowing: boolean;
  isFollowedBy: boolean;
  followersCount: number;
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

    const { data: mutualFollowData, error: mutualFollowError } = await supabase
      .from("followers")
      .select("id")
      .match({ follower_id: targetId, following_id: viewerId })
      .maybeSingle();

    if (mutualFollowError) throw mutualFollowError;

    const notificationType = mutualFollowData ? "follow_back" : "follow";
    const message = mutualFollowData ? `${actorUsername} followed you back` : `${actorUsername} followed you`;
    const { error: notificationError } = await supabase.from("notifications").insert({
      type: notificationType,
      message,
      target_id: targetId,
      actor_id: viewerId,
      user_id: targetId,
      created_at: new Date().toISOString(),
      is_read: false,
    });
    if (notificationError) throw notificationError;

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
    return true;
  } catch (e) {
    console.error("unfollowUser error", e);
    return false;
  }
}
