import type { VibesProPortraitProps } from '../types';
import { useLanguage } from '../../../contexts/LanguageContext';

export default function VibesProPortrait({ imageUrl, alt }: VibesProPortraitProps) {
  const { t } = useLanguage();
  const altText = alt ?? t('vibespro.portraitAlt');

  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-4xl overflow-hidden border border-white/20 shadow-2xl bg-slate-900">
      <img src={imageUrl} alt={altText} loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}
