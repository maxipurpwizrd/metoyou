import type { VibesProPostCardProps } from '../types';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function VibesProPostCard({
  title,
  description,
  mediaUrl,
  mediaType = 'image',
  badgeLabel,
  likeCount = 0,
  commentCount = 0,
  onClick,
}: VibesProPostCardProps) {
  const { t } = useLanguage();

  return (
    <article
      onClick={onClick}
      className="snap-center shrink-0 min-w-54 max-w-70 rounded-4xl overflow-hidden border border-white/10 bg-slate-950 shadow-2xl text-white transition hover:-translate-y-1 hover:shadow-2xl"
    >
      <div className="h-52 overflow-hidden bg-slate-900 sm:h-60">
        {mediaUrl ? (
          mediaType === 'video' ? (
            <video src={mediaUrl} className="w-full h-full object-cover" muted playsInline />
          ) : (
            <img src={mediaUrl} alt={title ?? t('vibespro.postAlt')} loading="lazy" className="w-full h-full object-cover" />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">{t('vibespro.noMedia')}</div>
        )}
      </div>
      <div className="p-3">
        {badgeLabel ? (
          <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            {badgeLabel}
          </span>
        ) : null}
        {title ? <h3 className="mt-2 text-lg font-bold">{title}</h3> : null}
        {description ? <p className="mt-2 text-sm leading-relaxed text-white/70 line-clamp-3">{description}</p> : null}
        <div className="mt-3 flex items-center gap-4 text-white/80 text-sm">
          <div className="inline-flex items-center gap-2">
            <span>❤️</span>
            <span>{likeCount}</span>
          </div>
          <div className="inline-flex items-center gap-2">
            <span>💬</span>
            <span>{commentCount}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
