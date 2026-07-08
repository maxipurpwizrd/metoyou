import { useMemo, useState } from 'react';
import VibesProHero from './VibesProHero';
import VibesProPostsCarousel from './VibesProPostsCarousel';
import ImageViewer from '../ImageViewer';
import type { VibesProPostType } from './types';

type VibesProProfilePageProps = {
  username: string;
  portraitUrl?: string;
  badgeLabel?: string;
  subtitle?: string;
  hommiesCount?: number;
  isOnline?: boolean;
  isFollowing?: boolean;
  followLabel?: string;
  posts?: VibesProPostType[];
  onFollow?: () => void;
  onMessage?: () => void;
  viewingOwn?: boolean;
  onUploadPortrait?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSavePortrait?: () => void;
  onCancelPortrait?: () => void;
  onAdjustPortraitPosition?: (position: string) => void;
  portraitPosition?: string;
  isUploadingPortrait?: boolean;
  previewPortraitActive?: boolean;
};

export default function VibesProProfilePage({
  username,
  portraitUrl,
  badgeLabel = 'Vibes Pro',
  hommiesCount = 0,
  isOnline = false,
  isFollowing = false,
  followLabel,
  posts = [],
  onFollow,
  onMessage,
  viewingOwn = false,
  onUploadPortrait,
  onSavePortrait,
  onCancelPortrait,
  onAdjustPortraitPosition,
  portraitPosition = 'center',
  isUploadingPortrait = false,
  previewPortraitActive = false,
}: VibesProProfilePageProps) {
  const mappedPosts = useMemo(() => posts, [posts]);
  const [selectedPostId, setSelectedPostId] = useState<string | number | null>(null);

  const mediaPosts = useMemo(
    () => mappedPosts.filter((post) => Boolean(post.mediaUrl)),
    [mappedPosts],
  );

  const selectedMediaIndex = selectedPostId === null
    ? -1
    : mediaPosts.findIndex((post) => post.id === selectedPostId);

  const handlePostSelect = (post: VibesProPostType) => {
    if (post.mediaUrl) {
      setSelectedPostId(post.id);
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-black">
      <div className="flex min-h-screen flex-col">
        <div className="shrink-0">
          <VibesProHero
            username={username}
            portraitUrl={portraitUrl ?? '/default-avatar.png'}
            badgeLabel={badgeLabel}
            hommiesCount={hommiesCount}
            isOnline={isOnline}
            isFollowing={isFollowing}
            followLabel={followLabel}
            onFollow={onFollow}
            onMessage={onMessage}
            viewingOwn={viewingOwn}
            onUploadPortrait={onUploadPortrait}
            onSavePortrait={onSavePortrait}
            onCancelPortrait={onCancelPortrait}
            onAdjustPortraitPosition={onAdjustPortraitPosition}
            portraitPosition={portraitPosition}
            isUploadingPortrait={isUploadingPortrait}
            previewPortraitActive={previewPortraitActive}
          />
        </div>

        <div className="bg-slate-950 px-4 pb-2 pt-2 text-white sm:px-6">
          <p className="text-center text-xs uppercase tracking-[0.3em] text-white/50">Posts</p>
        </div>

        <div className="flex-1 overflow-hidden">
          <VibesProPostsCarousel posts={mappedPosts} onPostSelect={handlePostSelect} />
        </div>
      </div>

      {selectedMediaIndex >= 0 && mediaPosts[selectedMediaIndex]?.mediaUrl ? (
        <ImageViewer
          images={mediaPosts.map((post) => post.mediaUrl as string)}
          initialIndex={selectedMediaIndex}
          onClose={() => setSelectedPostId(null)}
          postId={selectedPostId ?? undefined}
          authorUsername={username}
          variant="vibespro"
        />
      ) : null}
    </div>
  );
}
