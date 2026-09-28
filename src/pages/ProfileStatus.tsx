import { useState } from "react";
import { useProfileStatus } from "../hooks/useProfileStatus";
import { createAppeal } from "../lib/moderationApi";

export default function ProfileStatus() {
  const { status, loading, error } = useProfileStatus();
  const [details, setDetails] = useState("");
  const [appealMessage, setAppealMessage] = useState<string | null>(null);
  if (loading) return <div className="app-screen p-6 text-slate-700">Loading profile status...</div>;
  if (error || !status) return <div className="app-screen p-6 text-rose-700">{error ?? "Unable to load profile status."}</div>;
  const normal = status.account_status === "normal";
  const submitAppeal = async () => { try { await createAppeal(details); setAppealMessage("Appeal submitted."); } catch { setAppealMessage("Unable to submit appeal right now."); } };

  return <div className="app-screen min-h-screen p-4 pt-24 text-slate-900 md:p-8 md:pt-32"><div className="mx-auto max-w-2xl rounded-3xl border border-white/60 bg-white/75 p-6 shadow-2xl backdrop-blur-xl"><h1 className="text-2xl font-black">Profile Status</h1><div className={`mt-6 rounded-2xl p-5 ${normal ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><p className="text-lg font-bold">{normal ? "✅ Account in good standing" : `⚠️ ${status.account_status[0].toUpperCase()}${status.account_status.slice(1)} Mode`}</p>{status.reason && <p className="mt-3 text-sm">Reason: {status.reason}</p>}{status.effective_at && <p className="mt-1 text-sm">Date: {new Date(status.effective_at).toLocaleDateString()}</p>}</div>{status.appeal_id && <div className="mt-6"><p className="font-semibold">Appeal status: {status.appeal_status ?? "available"}</p>{!status.appeal_status || status.appeal_status === "pending" ? <><textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Explain your appeal" className="mt-3 min-h-28 w-full rounded-xl border border-slate-200 bg-white p-3" /><button type="button" onClick={() => void submitAppeal()} disabled={!details.trim()} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white disabled:opacity-50">Appeal</button></> : null}{appealMessage && <p className="mt-2 text-sm">{appealMessage}</p>}</div>}</div></div>;
}