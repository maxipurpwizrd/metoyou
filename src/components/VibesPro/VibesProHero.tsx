import { Link } from 'react-router-dom';
import { useRef } from 'react';
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
  onUploadPortrait,
  onRequestPortraitUpload,
  onConfirmPortraitUpload,
  onCancelPortraitUpload,
  onChooseCropPortrait,
  onSavePortrait,
  onCancelPortrait,
  onAdjustPortraitPosition,
  portraitPosition = 'center',
  isUploadingPortrait = false,
  previewPortraitActive = false,
  showPortraitConfirm = false,
  showCropConfirm = false,
  showCropPreview = false,
  cropPreviewUrl = null,
  cropZoom = 1,
  cropOffsetX = 0,
  cropOffsetY = 0,
  onApplyCropPreview,
  onCancelCropPreview,
  onCropZoomChange,
  onCropOffsetXChange,
  onCropOffsetYChange,
}: VibesProHeroProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasPortrait = Boolean(portraitUrl && portraitUrl !== '/default-avatar.png');

  const handleConfirmUpload = () => {
    onConfirmPortraitUpload?.();
    fileInputRef.current?.click();
  };

  return (
    <section className="sticky top-0 z-50 h-[58vh] min-h-[58vh] overflow-hidden bg-black text-white">
      {!hasPortrait && (
        <img src={throneTemplate} alt="Throne background" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      )}
      {hasPortrait ? (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.24),transparent_40%),linear-gradient(180deg,rgba(0,0,0,0.25),rgba(0,0,0,0.75))]" />
      ) : (
        <div className="absolute inset-0 bg-linear-to-b from-black/20 via-black/30 to-black/70" />
      )}

      <div className="absolute inset-0 pointer-events-none z-15">
        <div className="absolute inset-2 rounded-4xl border border-amber-200/50 shadow-[0_0_0_1px_rgba(255,215,0,0.12)]" />
        <div className="absolute inset-5 rounded-[28px] border border-amber-400/20" />
      </div>

      <div className="absolute inset-0 z-10">
        <div className="absolute inset-5 overflow-hidden rounded-[28px] bg-black/20 shadow-[0_20px_60px_rgba(0,0,0,0.55)] sm:inset-5">
          {hasPortrait ? (
            <img
              src={portraitUrl}
              alt={`${username} royal portrait`}
              className="h-full w-full object-cover object-center"
              style={{ objectPosition: portraitPosition }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              {/* empty frame placeholder for owner to upload portrait */}
            </div>
          )}
        </div>

        {viewingOwn && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={onRequestPortraitUpload ?? (() => fileInputRef.current?.click())}
              className="rounded-full border border-white/20 bg-black/50 p-3 text-white shadow-md backdrop-blur-sm"
              aria-label="Upload throne portrait"
            >
              📷
            </button>
            {previewPortraitActive && (
              <div className="rounded-2xl border border-amber-200/40 bg-black/65 p-2 text-[11px] shadow-lg backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('left')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">◀</button>
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('center')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">●</button>
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('right')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">▶</button>
                </div>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('top')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">↑</button>
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('center')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">↕</button>
                  <button type="button" onClick={() => onAdjustPortraitPosition?.('bottom')} className="rounded-full px-2 py-1 text-white/90 hover:bg-white/10">↓</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {previewPortraitActive && viewingOwn && (
        <div className="absolute inset-x-0 bottom-28 z-20 flex justify-center">
          <div className="flex gap-2 rounded-full border border-amber-200/40 bg-black/60 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
            <button type="button" onClick={onCancelPortrait} className="rounded-full border border-white/20 px-3 py-1 text-white/90 hover:bg-white/10">Cancel</button>
            <button type="button" onClick={onSavePortrait} className="rounded-full bg-amber-400 px-3 py-1 font-semibold text-amber-950">
              {isUploadingPortrait ? 'Uploading…' : 'Save portrait'}
            </button>
          </div>
        </div>
      )}

      {showPortraitConfirm && viewingOwn && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200/30 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">Portrait update</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Do You Really Wanna Change Your Profile Picture?</h2>
            <div className="mt-5 flex justify-center gap-3">
              <button type="button" onClick={onCancelPortraitUpload} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10">Cancel</button>
              <button type="button" onClick={handleConfirmUpload} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950">Yes</button>
            </div>
          </div>
        </div>
      )}

      {showCropConfirm && viewingOwn && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-3xl border border-amber-200/30 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">Next step</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Would you like to crop?</h2>
            <div className="mt-5 flex justify-center gap-3">
              <button type="button" onClick={() => onChooseCropPortrait?.(false)} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10">No</button>
              <button type="button" onClick={() => onChooseCropPortrait?.(true)} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950">Yes</button>
            </div>
          </div>
        </div>
      )}

      {showCropPreview && viewingOwn && (
        <div className="fixed inset-0 z-70 flex flex-col bg-black/95">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200">Crop preview</p>
              <h2 className="text-lg font-semibold text-white">Adjust your portrait</h2>
            </div>
            <button type="button" onClick={onCancelCropPreview} className="rounded-full border border-white/20 px-3 py-1 text-sm text-white/90 hover:bg-white/10">Cancel</button>
          </div>

          <div className="flex-1 overflow-hidden px-3 py-3 sm:px-6 sm:py-4">
            <div className="relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-black/70">
              {cropPreviewUrl ? (
                <img
                  src={cropPreviewUrl}
                  alt="Crop preview"
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ transform: `scale(${cropZoom}) translate(${cropOffsetX}px, ${cropOffsetY}px)` }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/60">No image selected</div>
              )}

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[72vw] max-h-[70vh] w-[72vw] max-w-105 rounded-full border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]" />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-slate-950/80 px-4 py-4 sm:px-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-3 text-sm text-white/85">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-[0.25em] text-amber-200">Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.1"
                  value={cropZoom}
                  onChange={(event) => onCropZoomChange?.(Number(event.target.value))}
                  className="w-full accent-amber-400"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.25em] text-amber-200">Move X</span>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    step="1"
                    value={cropOffsetX}
                    onChange={(event) => onCropOffsetXChange?.(Number(event.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs uppercase tracking-[0.25em] text-amber-200">Move Y</span>
                  <input
                    type="range"
                    min="-120"
                    max="120"
                    step="1"
                    value={cropOffsetY}
                    onChange={(event) => onCropOffsetYChange?.(Number(event.target.value))}
                    className="w-full accent-amber-400"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={onCancelCropPreview} className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/90 hover:bg-white/10">Discard</button>
                <button type="button" onClick={onApplyCropPreview} className="rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-amber-950">Use crop</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onUploadPortrait}
        className="hidden"
      />

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
