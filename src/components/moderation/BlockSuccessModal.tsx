import { CheckCircle2 } from "lucide-react";
import { createPortal } from "react-dom";

export default function BlockSuccessModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-emerald-200 bg-white p-6 text-center text-slate-800 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-black">User blocked</h2>
        <p className="mt-2 text-sm text-slate-600">You have successfully blocked this user.</p>
        <button type="button" onClick={onClose} className="mt-5 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800">
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}