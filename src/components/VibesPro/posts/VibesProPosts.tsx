import type { VibesProPostsProps } from '../types';

export default function VibesProPosts({ children }: VibesProPostsProps) {
  return (
    <section className="w-full overflow-x-auto snap-x snap-mandatory scroll-smooth py-3 -mt-2">
      <div className="flex gap-3 min-w-max px-3 sm:px-4">{children}</div>
    </section>
  );
}
