import { Link } from 'react-router-dom';
import type { VibesProHeroProps } from './types';
import FollowButton from '../social/FollowButton';
import throneTemplate from './assets/throne-template.png';

export default function VibesProHero({
  username,
  portraitUrl,
  isOnline = false,
  hommiesCount = 0,
  badgeLabel = 'Vibes Pro',
  isFollowing = false,
  followLabel,
  onFollow,
  onMessage,
  viewingOwn = false,
}: VibesProHeroProps) {
  return (
    <section className="sticky top-0 z-50 h-[58vh] min-h-[58vh] overflow-hidden bg-black text-white">
      <img src={throneTemplate} alt="Throne background" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/30 to-black/70" />

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-2 rounded-4xl border border-amber-200/50 shadow-[0_0_0_1px_rgba(255,215,0,0.12)]" />
        <div className="absolute inset-5 rounded-[28px] border border-amber-400/20" />
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
        <div className="relative flex items-center justify-center">
          {portraitUrl && !portraitUrl.includes('/default-avatar.png') ? (
            <img
              src={portraitUrl}
              alt={`${username} royal portrait`}
              className="h-[58%] w-auto max-w-[82%] object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.55)] rounded-full"
            />
          ) : (
            <div className="h-[58%] w-[58%] max-w-[82%] rounded-full border border-white/10 bg-black/20 flex items-center justify-center">
              {/* empty circle placeholder for owner to upload portrait */}
            </div>
          )}

          {viewingOwn && (
            <button
              type="button"
              onClick={() => window.alert('Open portrait upload')}
              className="absolute rounded-full bg-black/50 border border-white/20 p-3 text-white shadow-md"
              aria-label="Update throne portrait"
            >
              📷
            </button>
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 sm:p-5">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg text-white shadow-lg backdrop-blur-sm"
          aria-label="Go back"
        >
          ←
        </button>
        {viewingOwn && (
          <Link
            to="/settings"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/30 text-lg text-white shadow-lg backdrop-blur-sm"
            aria-label="Open settings"
          >
            ⚙
          </Link>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-4 pb-5 text-center sm:px-6 sm:pb-6">
        <div className="inline-flex items-center rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200 backdrop-blur-sm">
          {badgeLabel}
        </div>

        <h1 className="text-3xl font-black leading-tight sm:text-4xl bg-linear-to-b from-[#FFF3B0] via-[#FFD700] to-[#B8860B] bg-clip-text text-transparent">
          {username}
        </h1>

        {!viewingOwn && (
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/85 backdrop-blur-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </div>
        )}

        <div className="text-sm text-white/85">{hommiesCount} Hommies</div>

        {!viewingOwn && (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <FollowButton
              label={followLabel ?? (isFollowing ? 'Following' : 'Follow')}
              isFollowing={isFollowing}
              loading={false}
              onClick={onFollow ?? (() => {})}
            />
            <button
              type="button"
              onClick={onMessage}
              className="rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur-sm"
            >
              Message
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
