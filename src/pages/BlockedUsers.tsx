import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BlockedUsersSection from "../components/settings/BlockedUsersSection";

export default function BlockedUsers() {
  const navigate = useNavigate();

  return (
    <>
      <button type="button" onClick={() => navigate(-1)} className="fixed left-4 top-24 z-10 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur md:left-8 md:top-32">
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <BlockedUsersSection page />
    </>
  );
}