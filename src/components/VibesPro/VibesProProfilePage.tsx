import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from "../../contexts/LanguageContext";
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
  onOpenHommiesList?: () => void;
  viewingOwn?: boolean;
  hommiesListOpen?: boolean;
  onCloseHommiesList?: () => void;
  hommiesListLoading?: boolean;
  hommiesSearch?: string;
  onHommiesSearchChange?: (value: string) => void;
  mutualConnections?: Array<{ id: string; username: string; profilePic?: string | null }>;
  filteredMutualConnections?: Array<{ id: string; username: string; profilePic?: string | null }>;
  onSelectHommie?: (connection: { id: string; username: string; profilePic?: string | null }) => void;
  recentFollowerIds?: string[];
  onUploadPortrait?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRequestPortraitUpload?: () => void;
  onConfirmPortraitUpload?: () => void;
  onCancelPortraitUpload?: () => void;
  onChooseCropPortrait?: (shouldCrop: boolean) => void;
  onSavePortrait?: () => void;
  onCancelPortrait?: () => void;
  onAdjustPortraitPosition?: (position: string) => void;
  portraitPosition?: string;
  isUploadingPortrait?: boolean;
  previewPortraitActive?: boolean;
  showPortraitConfirm?: boolean;
  showCropConfirm?: boolean;
  showCropPreview?: boolean;
  cropPreviewUrl?: string | null;
  cropZoom?: number;
  cropOffsetX?: number;
  cropOffsetY?: number;
  onApplyCropPreview?: () => void;
  onCancelCropPreview?: () => void;
  onCropZoomChange?: (value: number) => void;
  onCropOffsetXChange?: (value: number) => void;
  onCropOffsetYChange?: (value: number) => void;
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
  onOpenHommiesList,
  viewingOwn = false,
  hommiesListOpen = false,
  onCloseHommiesList,
  hommiesListLoading = false,
  hommiesSearch = '',
  onHommiesSearchChange,
  filteredMutualConnections = [],
  onSelectHommie,
  recentFollowerIds = [],
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
}: VibesProProfilePageProps) {
  const mappedPosts = useMemo(() => posts, [posts]);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handlePostSelect = (post: VibesProPostType) => {
    if (post.mediaUrl) {
      const params = new URLSearchParams({ image: post.mediaUrl });
      params.set("postId", String(post.id));
      navigate(`/flicks?${params.toString()}`);
    }
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-black">
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
            onOpenHommiesList={onOpenHommiesList}
            viewingOwn={viewingOwn}
            onUploadPortrait={onUploadPortrait}
            onRequestPortraitUpload={onRequestPortraitUpload}
            onConfirmPortraitUpload={onConfirmPortraitUpload}
            onCancelPortraitUpload={onCancelPortraitUpload}
            onChooseCropPortrait={onChooseCropPortrait}
            onSavePortrait={onSavePortrait}
            onCancelPortrait={onCancelPortrait}
            onAdjustPortraitPosition={onAdjustPortraitPosition}
            portraitPosition={portraitPosition}
            isUploadingPortrait={isUploadingPortrait}
            previewPortraitActive={previewPortraitActive}
            showPortraitConfirm={showPortraitConfirm}
            showCropConfirm={showCropConfirm}
            showCropPreview={showCropPreview}
            cropPreviewUrl={cropPreviewUrl}
            cropZoom={cropZoom}
            cropOffsetX={cropOffsetX}
            cropOffsetY={cropOffsetY}
            onApplyCropPreview={onApplyCropPreview}
            onCancelCropPreview={onCancelCropPreview}
            onCropZoomChange={onCropZoomChange}
            onCropOffsetXChange={onCropOffsetXChange}
            onCropOffsetYChange={onCropOffsetYChange}
          />
        </div>

        <div className="flex-1 overflow-hidden px-4 pb-4 pt-3 sm:px-6">
          <div className="flex h-full min-h-80 flex-col overflow-hidden rounded-4xl border border-amber-400/20 bg-slate-950/95 shadow-[0_24px_80px_rgba(255,215,0,0.12)]">
            <div className="px-4 pb-2 pt-2 text-white sm:px-6">
              <p className="text-center text-xs uppercase tracking-[0.3em] text-white/50">{t("vibespro.posts")}</p>
            </div>

            <div className="flex-1 overflow-hidden">
              <VibesProPostsCarousel posts={mappedPosts} onPostSelect={handlePostSelect} />
            </div>
          </div>
        </div>
      </div>

      {hommiesListOpen ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 px-4 py-6" onClick={onCloseHommiesList}>
          <div className="w-full max-w-md rounded-[28px] border border-amber-200/40 bg-slate-950/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between rounded-2xl border border-amber-200/20 bg-linear-to-r from-amber-400/15 via-amber-300/10 to-yellow-300/10 px-3 py-3">
              <div>
                <h3 className="text-lg font-black text-[#FFF3B0]">{t("profile.hommiesList.title")}</h3>
                <p className="text-sm text-amber-100/80">{t("profile.hommies")}</p>
              </div>
              <button type="button" onClick={onCloseHommiesList} className="rounded-full border border-amber-200/30 bg-black/30 px-3 py-1 text-sm font-semibold text-amber-100 transition hover:bg-black/40">
                ✕
              </button>
            </div>

            <div className="mt-4">
              <label className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-200/25 bg-black/30 px-3 py-2 text-sm text-amber-50/90">
                <span>🔎</span>
                <input
                  type="text"
                  value={hommiesSearch}
                  onChange={(event) => onHommiesSearchChange?.(event.target.value)}
                  placeholder={t("profile.hommiesList.searchPlaceholder")}
                  className="w-full border-0 bg-transparent outline-none placeholder:text-amber-100/50"
                />
              </label>

              <div className="max-h-[min(55vh,28rem)] overflow-y-auto pr-1">
                {hommiesListLoading ? (
                  <div className="rounded-2xl border border-amber-200/20 bg-black/20 px-4 py-6 text-center text-sm text-amber-100/80">
                    {t("profile.hommiesList.loading")}
                  </div>
                ) : filteredMutualConnections.length === 0 ? (
                  <div className="rounded-2xl border border-amber-200/20 bg-black/20 px-4 py-6 text-center text-sm text-amber-100/80">
                    {hommiesSearch.trim()
                      ? t("profile.hommiesList.noSearchResults")
                      : t("profile.hommiesList.empty")}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMutualConnections.map((connection) => (
                      <button
                        key={connection.id}
                        type="button"
                        onClick={() => onSelectHommie?.(connection)}
                        className="relative flex w-full items-center gap-3 rounded-2xl border border-amber-200/20 bg-white/10 px-3 py-3 text-left shadow-sm transition hover:bg-white/15"
                      >
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#FFD700] via-[#FFB800] to-[#B8860B] text-sm font-semibold text-slate-950">
                          {connection.profilePic ? (
                            <img src={connection.profilePic} alt={connection.username} className="h-full w-full object-cover" />
                          ) : (
                            connection.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#FFF3B0]">{connection.username}</p>
                          <p className="text-xs text-amber-100/70">{t("profile.homie")}</p>
                        </div>
                        {recentFollowerIds.includes(connection.id) ? (
                          <span className="ml-auto h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.16)]" aria-label="recent follower" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
