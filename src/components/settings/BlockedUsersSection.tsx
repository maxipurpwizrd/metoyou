import { useEffect, useState } from "react";
import { Ban, UserRoundX } from "lucide-react";
import { getBlockedUsers, unblockUser, type BlockedUser } from "../../lib/moderationApi";

export default function BlockedUsersSection({ page = false }: { page?: boolean }) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBlockedUsers()
      .then((users) => { if (active) setBlockedUsers(users); })
      .catch(() => { if (active) setError("Unable to load your blocked users right now."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleUnblock = async (userId: string) => {
    setBusyUserId(userId);
    setError(null);
    try {
      await unblockUser(userId);
      setBlockedUsers((users) => users.filter((user) => user.id !== userId));
    } catch {
      setError("Unable to unblock this user right now.");
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <section className={`${page ? "app-screen min-h-screen p-4 pt-24 md:p-8 md:pt-32" : "bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[32px] shadow-2xl p-6"}`}>
      <div className={page ? "mx-auto max-w-2xl rounded-3xl border border-white/60 bg-white/75 p-6 shadow-2xl backdrop-blur-xl" : undefined}>
      <div className="flex items-center gap-3 mb-6">
        <div className="grid place-items-center w-12 h-12 rounded-3xl bg-rose-500/15 text-rose-700">
          <Ban className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Privacy</p>
          <h2 className="text-2xl font-bold text-slate-900">Blocked users</h2>
        </div>
      </div>

      {loading ? <p className="text-sm text-slate-500">Loading blocked users...</p> : blockedUsers.length === 0 ? (
        <p className="text-sm text-slate-500">You have not blocked anyone.</p>
      ) : (
        <div className="grid gap-3">
          {blockedUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/30 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                {user.profile_pic ? <img src={user.profile_pic} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500"><UserRoundX className="h-5 w-5" /></div>}
                <span className="truncate font-semibold text-slate-900">{user.username}</span>
              </div>
              <button type="button" onClick={() => void handleUnblock(user.id)} disabled={busyUserId === user.id} className="shrink-0 rounded-xl border border-slate-300 bg-white/70 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-wait disabled:opacity-60">
                {busyUserId === user.id ? "Unblocking..." : "Unblock"}
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-sm text-rose-600" role="alert">{error}</p>}
      </div>
    </section>
  );
}