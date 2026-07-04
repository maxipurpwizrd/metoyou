import { useMemo } from 'react';
import VibesProHero from './VibesProHero';
import VibesProPostsCarousel from './VibesProPostsCarousel';
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
};

export default function VibesProProfilePage({
  username,
  portraitUrl,
  badgeLabel = 'Vibes Pro',
  subtitle,
  hommiesCount = 0,
  isOnline = false,
  isFollowing = false,
  followLabel,
  posts = [],
  onFollow,
  onMessage,
  viewingOwn = false,
}: VibesProProfilePageProps) {
  const mappedPosts = useMemo(() => posts, [posts]);

  return (
    <div className="h-screen overflow-hidden bg-black">
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0">
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
          />
        </div>

        <div className="bg-slate-950 px-4 pb-3 pt-3 text-white sm:px-6">
          <p className="text-center text-sm uppercase tracking-[0.3em] text-white/50">Posts</p>
        </div>

        <div className="flex-1 overflow-hidden">
          <VibesProPostsCarousel posts={mappedPosts} />
        </div>
      </div>
    </div>
  );
}
