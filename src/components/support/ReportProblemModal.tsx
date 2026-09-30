import { useState } from "react";
import { createPortal } from "react-dom";
import { createSupportTicket, SUPPORT_CATEGORIES, type SupportCategory } from "../../lib/moderationApi";
import { useLanguage } from "../../contexts/LanguageContext";

const SUPPORT_CATEGORY_KEYS: Record<SupportCategory, string> = {
  app_crash: "support.category.appCrash",
  messages: "support.category.messages",
  calls: "support.category.calls",
  feed: "support.category.feed",
  profile: "support.category.profile",
  payments: "support.category.payments",
  media: "support.category.media",
  other: "support.category.other",
};

export default function ReportProblemModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<SupportCategory>("other");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!open) return null;

  const submit = async () => {
    if (!description.trim()) return;
    setBusy(true); setMessage(null);
    try { await createSupportTicket({ category, description, file }); setMessage(t("support.submitted")); setDescription(""); setFile(undefined); }
    catch { setMessage(t("support.sendError")); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-5 text-slate-800 shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{t("support.title")}</h2><button type="button" onClick={onClose}>{t("common.close")}</button></div>
        <select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)} className="mt-4 w-full rounded-xl border border-slate-200 p-3">{SUPPORT_CATEGORIES.map((item) => <option key={item} value={item}>{t(SUPPORT_CATEGORY_KEYS[item])}</option>)}</select>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder={t("support.descriptionPlaceholder")} className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 p-3" />
        <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0])} className="mt-3 w-full text-sm" />
        {message && <p className="mt-3 text-sm font-semibold">{message}</p>}
        <button type="button" disabled={busy || !description.trim()} onClick={() => void submit()} className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? t("support.sending") : t("support.send")}</button>
      </div>
    </div>, document.body,
  );
}