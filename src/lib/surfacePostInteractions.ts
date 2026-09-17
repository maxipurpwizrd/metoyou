import { getComments, type CommentRecord } from "./commentApi";
import { getPostLikes, hasUserLiked } from "./likeApi";

type SurfacePostCounts = {
  id: string;
  likes_count: number;
  comments_count: number;
};

export async function hydrateSurfacePostInteractions<T extends SurfacePostCounts>(rows: T[], userId?: string) {
  return Promise.all(rows.map(async (row) => {
    const [likes, comments, liked] = await Promise.all([
      getPostLikes(row.id),
      getComments(row.id),
      userId ? hasUserLiked(row.id, userId) : Promise.resolve(false),
    ]);

    return {
      ...row,
      likes_count: likes.length,
      comments_count: comments.length,
      liked,
    };
  }));
}

export async function getSurfacePostInteractionCounts(postId: string): Promise<Pick<SurfacePostCounts, "likes_count" | "comments_count">> {
  const [likes, comments] = await Promise.all([
    getPostLikes(postId),
    getComments(postId),
  ]);

  return {
    likes_count: likes.length,
    comments_count: comments.length,
  };
}

export type { CommentRecord };