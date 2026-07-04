import React, { useEffect, useRef, useState } from 'react';
import type { VibesProPostType } from './types';

type VibesProPostsCarouselProps = {
  posts: VibesProPostType[];
};

export default function VibesProPostsCarousel({ posts }: VibesProPostsCarouselProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const children = Array.from(el.children) as HTMLElement[];
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      children.forEach((child, idx) => {
        const mid = child.offsetLeft + child.clientWidth / 2;
        const dist = Math.abs(mid - center);
        if (dist < closestDist) {
          closestDist = dist;
          closest = idx;
        }
      });
      setActiveIndex(closest);
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, [posts]);

  return (
    <section className="w-full bg-[#050509] px-3 py-2 sm:px-4">
      <div
        ref={containerRef}
        className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
        aria-label="Vibes Pro posts carousel"
      >
        {posts.map((post) => (
          <article
            key={post.id}
            className="w-[26vw] h-[26vh] md:w-[180px] md:h-[190px] shrink-0 snap-start overflow-hidden rounded-2xl border border-amber-600/20 bg-slate-900 text-white shadow-lg relative"
          >
            {post.mediaUrl ? (
              <img src={post.mediaUrl} alt={post.title ?? 'Vibes Pro post'} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-white/70">
                {post.description ?? 'No media'}
              </div>
            )}

            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent rounded-2xl pointer-events-none" />

            <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs font-semibold text-white/90">
                  ❤️ <span className="text-sm">{post.likes ?? 0}</span>
                </div>
                <div className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs font-semibold text-white/90">
                  💬 <span className="text-sm">{post.comments ?? 0}</span>
                </div>
              </div>

              {post.badgeLabel ? (
                <div className="inline-flex items-center rounded-full bg-amber-700/10 px-2 py-1 text-[10px] font-semibold tracking-wide text-amber-300">
                  {post.badgeLabel}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {posts.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to post ${i + 1}`}
            onClick={() => {
              const el = containerRef.current;
              if (!el) return;
              const child = el.children[i] as HTMLElement | undefined;
              if (child) el.scrollTo({ left: child.offsetLeft - 12, behavior: 'smooth' });
            }}
            className={`w-2 h-2 rounded-full ${i === activeIndex ? 'bg-amber-400' : 'bg-white/30'}`}
          />
        ))}
      </div>
    </section>
  );
}
