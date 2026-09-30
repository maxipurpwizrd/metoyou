import { createPortal } from "react-dom";
import { useLanguage } from "../../contexts/LanguageContext";

export default function BlockedUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-10000 grid place-items-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center text-slate-800 shadow-2xl">
        <h2 className="text-lg font-bold">{t("block.cannotInteract")}</h2>
        <button type="button" onClick={onClose} className="mt-5 rounded-xl bg-slate-900 px-5 py-2 font-semibold text-white">{t("block.quit")}</button>
      </div>
    </div>, document.body,
  );
}