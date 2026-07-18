import type { VibesProActionsProps } from '../types';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function VibesProActions({ isFollowing = false, onFollow, onMessage, onGift }: VibesProActionsProps) {
  const { t } = useLanguage();

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onFollow}
        className="rounded-3xl bg-white text-slate-950 px-4 py-2 text-sm font-semibold shadow-2xl transition hover:brightness-105"
      >
        {isFollowing ? t('vibespro.following') : t('vibespro.follow')}
      </button>
      <button
        type="button"
        onClick={onMessage}
        className="rounded-3xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-2xl transition hover:bg-white/20"
      >
        {t('vibespro.message')}
      </button>
      <button
        type="button"
        onClick={onGift}
        className="rounded-3xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-2xl transition hover:bg-white/20"
      >
        {t('vibespro.gift')}
      </button>
    </div>
  );
}
