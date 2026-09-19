import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const POST_REPORT_REASONS = [
  "Bullying or abuse",
  "Adult Content",
  "Fraud or Scam",
  "I don't just wanna see this",
] as const;

export type PostReportReason = (typeof POST_REPORT_REASONS)[number];

type ReportReasonModalProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (reason: PostReportReason) => Promise<void>;
};

export default function ReportReasonModal({ open, onClose, onSelect }: ReportReasonModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleSelect = async (reason: PostReportReason) => {
    setIsSubmitting(true);
    setError(null);

    try {
      await onSelect(reason);
      onClose();
    } catch {
      setError("Unable to submit this report right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-black/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-reason-title">
      <button type="button" aria-label="Close report dialog" onClick={onClose} className="absolute inset-0" disabled={isSubmitting} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-sky-100 bg-white p-5 text-slate-800 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="report-reason-title" className="text-lg font-semibold">Why do you wanna report this post?</h2>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="text-sm text-slate-400 hover:text-slate-700" aria-label="Close report dialog">
            Close
          </button>
        </div>
        <div className="space-y-2">
          {POST_REPORT_REASONS.map((reason, index) => (
            <button
              key={reason}
              type="button"
              onClick={() => void handleSelect(reason)}
              disabled={isSubmitting}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="font-semibold text-slate-400">{index + 1}.</span>
              <span>{reason}</span>
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
      </div>
    </div>,
    document.body,
  );
}
