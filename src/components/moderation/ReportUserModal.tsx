import { useState } from "react";
import { createPortal } from "react-dom";
import { createUserReport } from "../../lib/moderationApi";
import { useLanguage } from "../../contexts/LanguageContext";

const REASONS = ["Spam", "Harassment", "Impersonation", "Inappropriate content", "Scam/Fraud", "Other"];
const REASON_KEYS: Record<string, string> = {
  Spam: "report.userReason.spam",
  Harassment: "report.userReason.harassment",
  Impersonation: "report.userReason.impersonation",
  "Inappropriate content": "report.userReason.inappropriate",
  "Scam/Fraud": "report.userReason.fraud",
  Other: "support.category.other",
};

export default function ReportUserModal({ open, userId, onClose }: { open: boolean; userId: string; onClose: () => void }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return null;

  const submit = async () => {
    setBusy(true); setError(null);
    try { await createUserReport({ reportedUserId: userId, reason, details }); setSubmitted(true); }
    catch { setError(t("report.error")); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-slate-800 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{t("report.userTitle")}</h2><button type="button" onClick={onClose}>{t("common.close")}</button></div>
        {submitted ? <><p className="mt-6 text-center font-semibold text-emerald-700">{t("report.submitted")}</p><button type="button" onClick={onClose} className="mt-4 w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white">{t("report.done")}</button></> : <>
        <label className="mt-4 block text-sm font-semibold">{t("report.reason")}<select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 p-3">{REASONS.map((item) => <option key={item}>{t(REASON_KEYS[item])}</option>)}</select></label>
        <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder={t("report.additionalDetails")} className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 p-3" />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <button type="button" disabled={busy} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? t("report.sending") : t("report.sendUser")}</button>
        </>}
      </div>
    </div>, document.body,
  );
}