import { useLanguage } from "../../contexts/LanguageContext";

export default function BlockedChatState({ canUnblock, busy, onUnblock }: { canUnblock: boolean; busy: boolean; onUnblock: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-4 text-center text-amber-900 shadow-sm">
      <p className="font-semibold">{t("block.cannotInteract")}</p>
      {canUnblock ? (
        <button type="button" onClick={onUnblock} disabled={busy} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? t("block.unblocking") : t("block.unblock")}
        </button>
      ) : <p className="mt-1 text-xs text-amber-800/80">{t("block.locked")}</p>}
    </div>
  );
}