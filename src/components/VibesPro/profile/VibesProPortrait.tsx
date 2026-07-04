import type { VibesProPortraitProps } from '../types';

export default function VibesProPortrait({ imageUrl, alt = 'Vibes Pro portrait' }: VibesProPortraitProps) {
  return (
    <div className="relative w-48 h-48 md:w-56 md:h-56 rounded-4xl overflow-hidden border border-white/20 shadow-2xl bg-slate-900">
      <img src={imageUrl} alt={alt} className="w-full h-full object-cover" />
    </div>
  );
}
