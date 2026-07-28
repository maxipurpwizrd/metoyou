import { useEffect, useRef, useState } from "react";

type Props = {
  isOpen: boolean;
  initialValue: string;
  onClose: () => void;
  onSave: (nextText: string) => void;
  isPremiumTheme?: boolean;
};

export default function EditPostModal({
  isOpen,
  initialValue,
  onClose,
  onSave,
  isPremiumTheme = false,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
    }
  }, [initialValue, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const onScroll = () => {
      const activeElement = document.activeElement;
      if (dialogRef.current?.contains(activeElement)) {
        return;
      }

      onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll);
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center px-3 py-4 sm:px-6">
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        onTouchStart={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-xl"
        aria-label="Close editor"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit post"
        onClick={(event) => event.stopPropagation()}
        className={`relative z-10 w-full max-w-xl rounded-[28px] border p-4 shadow-2xl sm:p-5 ${isPremiumTheme
          ? "border-amber-300/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.97),rgba(255,244,183,0.9))]"
          : "border-white/70 bg-white/95"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${isPremiumTheme ? "text-amber-950" : "text-slate-800"}`}>
              Edit your post
            </p>
            <p className={`mt-1 text-xs ${isPremiumTheme ? "text-amber-800/80" : "text-slate-500"}`}>
              {isPremiumTheme ? "Polish the moment with the same glow as your Vibes Pro feed." : "Keep the tone playful, polished, and on-brand."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${isPremiumTheme ? "border-amber-300/80 bg-white/70 text-amber-900" : "border-slate-200 bg-white text-slate-600"}`}
          >
            Close
          </button>
        </div>

        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={8}
          maxLength={500}
          placeholder="Write something beautiful..."
          className={`w-full resize-none rounded-2xl border px-3 py-3 text-sm leading-6 outline-none transition ${isPremiumTheme
            ? "border-amber-200/80 bg-white/80 text-amber-950 placeholder:text-amber-700/60 focus:border-amber-400"
            : "border-slate-200 bg-slate-50/80 text-slate-700 placeholder:text-slate-400 focus:border-pink-300"
          }`}
        />

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className={`text-xs ${isPremiumTheme ? "text-amber-800/80" : "text-slate-500"}`}>
            {value.length}/500 characters
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${isPremiumTheme ? "bg-white/70 text-amber-900 hover:bg-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(value)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold text-white transition ${isPremiumTheme ? "bg-linear-to-r from-amber-500 via-yellow-500 to-orange-500 hover:opacity-90" : "bg-linear-to-r from-pink-500 via-purple-500 to-blue-500 hover:opacity-90"}`}
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
