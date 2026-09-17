import { Ban, Download, Flag, Grid2X2, Link, Pencil, Repeat2, Share2, Sparkles, Trash2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect } from "react";

export type MediaAction = {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  icon: "share" | "download" | "repost" | "report" | "block" | "close" | "edit" | "delete" | "highlight" | "link";
};

const icons = {
  share: Share2,
  download: Download,
  repost: Repeat2,
  report: Flag,
  block: Ban,
  close: X,
  edit: Pencil,
  delete: Trash2,
  highlight: Sparkles,
  link: Link,
};

export default function MediaActionMenu({
  open,
  isDark,
  onToggle,
  onClose,
  actions,
}: {
  open: boolean;
  isDark: boolean;
  onToggle: () => void;
  onClose: () => void;
  actions: MediaAction[];
}) {
  useEffect(() => {
    if (!open) return;

    const closeOnScroll = () => onClose();
    window.addEventListener("scroll", closeOnScroll, { passive: true });
    return () => window.removeEventListener("scroll", closeOnScroll);
  }, [onClose, open]);

  return (
    <>
      <button type="button" onClick={(event) => { event.stopPropagation(); onToggle(); }} aria-label="More actions" className="text-white/90 transition hover:scale-110">
        <Grid2X2 className="h-6 w-6" />
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-9999 grid place-items-center bg-black/35 p-4 backdrop-blur-sm" onClick={onClose}>
          <button type="button" aria-label="Close actions" onClick={onClose} className="absolute inset-0" />
          <div onClick={(event) => event.stopPropagation()} className={`relative z-10 grid w-full max-w-xs grid-cols-2 gap-2 rounded-2xl border p-3 text-left text-xs shadow-2xl ${isDark ? "border-white/15 bg-slate-950 text-white" : "border-sky-100 bg-white text-slate-700"}`}>
            {actions.map((action) => {
              const Icon = icons[action.icon];
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center ${action.tone === "danger" ? "text-rose-500 hover:bg-rose-50" : "hover:bg-sky-50"} ${action.icon === "block" || action.icon === "close" ? "col-span-2" : ""}`}
                >
                  <Icon className="h-5 w-5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
