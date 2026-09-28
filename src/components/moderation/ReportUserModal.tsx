import { useState } from "react";
import { createPortal } from "react-dom";
import { createUserReport } from "../../lib/moderationApi";

const REASONS = ["Spam", "Harassment", "Impersonation", "Inappropriate content", "Scam/Fraud", "Other"];

export default function ReportUserModal({ open, userId, onClose }: { open: boolean; userId: string; onClose: () => void }) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const submit = async () => {
    setBusy(true); setError(null);
    try { await createUserReport({ reportedUserId: userId, reason, details }); setSubmitted(true); }
    catch { setError("Unable to submit this report right now."); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-slate-800 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Report user</h2><button type="button" onClick={onClose}>Close</button></div>
        {submitted ? <><p className="mt-6 text-center font-semibold text-emerald-700">Report submitted ✅</p><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">Done</button></> : <>
        <label className="mt-4 block text-sm font-semibold">Reason<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3">{REASONS.map((item) => <option key={item}>{item}</option>)}</select></label>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Additional details (optional)" className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 p-3" />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Sending..." : "Send report"}</button>
        </>}
      </div>
    </div>, document.body,
  );
}