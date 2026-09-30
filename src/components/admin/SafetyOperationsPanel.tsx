import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useLanguage } from "../../contexts/LanguageContext";

type ReportRow = { id: string; reported_user_id: string; reason: string; details: string | null; status: string };
type AppealRow = { id: string; user_id: string; details: string; status: string };
type TicketRow = { id: string; user_id: string; category: string; description: string; status: string };

export default function SafetyOperationsPanel() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"reports" | "appeals" | "support">("reports");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [appeals, setAppeals] = useState<AppealRow[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("reports").select("id, reported_user_id, reason, details, status").order("created_at", { ascending: false }).limit(50),
      supabase.from("moderation_appeals").select("id, user_id, details, status").order("created_at", { ascending: false }).limit(50),
      supabase.from("support_tickets").select("id, user_id, category, description, status").order("created_at", { ascending: false }).limit(50),
    ]).then(([reportResult, appealResult, ticketResult]) => {
      if (!active) return;
      const failure = reportResult.error ?? appealResult.error ?? ticketResult.error;
      if (failure) { setError(t("admin.loadSafetyError")); return; }
      setReports((reportResult.data ?? []) as ReportRow[]);
      setAppeals((appealResult.data ?? []) as AppealRow[]);
      setTickets((ticketResult.data ?? []) as TicketRow[]);
    });
    return () => { active = false; };
  }, []);

  const dismissReport = async (id: string) => {
    const { error: updateError } = await supabase.from("reports").update({ status: "dismissed", resolved_at: new Date().toISOString() }).eq("id", id);
    if (updateError) { setError(t("admin.dismissError")); return; }
    setReports((current) => current.map((report) => report.id === id ? { ...report, status: "dismissed" } : report));
  };

  const statusLabel = (status: string) => status === "pending" ? t("admin.pending") : status === "dismissed" ? t("admin.dismissed") : status;

  return <section className="mt-6 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{t("admin.safetyOperations")}</p><h2 className="text-xl font-bold">{t("admin.moderationAppealsSupport")}</h2></div><div className="flex gap-2">{([['reports', t("admin.reports")], ['appeals', t("admin.appeals")], ['support', t("settings.support")]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${tab === value ? "bg-slate-900 text-white" : "bg-white text-slate-600"}`}>{label}</button>)}</div></div>
    {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
    <div className="mt-4 space-y-3">{tab === "reports" && reports.map((report) => <article key={report.id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{report.reason}</p><p className="text-xs text-slate-500">{t("admin.reportedUser")}: {report.reported_user_id} · {statusLabel(report.status)}</p>{report.details && <p className="mt-2 text-sm">{report.details}</p>}</div>{report.status === "pending" && <button type="button" onClick={() => void dismissReport(report.id)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold">{t("admin.dismiss")}</button>}</div></article>)}{tab === "appeals" && appeals.map((appeal) => <article key={appeal.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold">{statusLabel(appeal.status)}</p><p className="text-xs text-slate-500">{t("admin.user")}: {appeal.user_id}</p><p className="mt-2 text-sm">{appeal.details}</p></article>)}{tab === "support" && tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="font-semibold">{ticket.category} · {statusLabel(ticket.status)}</p><p className="text-xs text-slate-500">{t("admin.user")}: {ticket.user_id}</p><p className="mt-2 text-sm">{ticket.description}</p></article>)}{((tab === "reports" && reports.length === 0) || (tab === "appeals" && appeals.length === 0) || (tab === "support" && tickets.length === 0)) && <p className="text-sm text-slate-500">{t("admin.noRecords")}</p>}</div>
  </section>;
}