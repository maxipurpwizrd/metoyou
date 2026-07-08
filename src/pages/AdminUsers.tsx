import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Trash2, User } from "lucide-react";
import { supabase } from "../lib/supabase";

type AdminUserSearchResult = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePic: string | null;
  joinedAt: string | null;
  email: string | null;
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminUserQuery, setAdminUserQuery] = useState("");
  const [adminSearchResults, setAdminSearchResults] = useState<AdminUserSearchResult[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserSearchResult | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const verifyAdminAccess = async () => {
      setIsCheckingAccess(true);
      setHasAdminAccess(false);

      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user?.id) {
          return;
        }

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (profileError) {
          return;
        }

        setHasAdminAccess(profileData?.is_admin === true);
      } catch {
        if (isMounted) {
          setHasAdminAccess(false);
        }
      } finally {
        if (isMounted) {
          setIsCheckingAccess(false);
        }
      }
    };

    void verifyAdminAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadUsers = async (searchTerm = "") => {
    setIsSearchingUsers(true);

    try {
      let request = supabase
        .from("profiles")
        .select("id, username, email")
        .order("username", { ascending: true });

      const normalizedSearch = searchTerm.trim();
      if (normalizedSearch) {
        request = request.or(`username.ilike.%${normalizedSearch}%,email.ilike.%${normalizedSearch}%`);
      }

      const { data, error } = await request;

      if (error) {
        throw error;
      }

      setAdminSearchResults(
        (data ?? []).map((item: any) => ({
          id: item.id,
          username: item.username ?? "",
          firstName: "",
          lastName: "",
          profilePic: null,
          joinedAt: null,
          email: item.email ?? null,
        }))
      );
    } catch (error) {
      console.error("loadUsers error", error);
      setAdminSearchResults([]);
      window.alert("Unable to load users right now.");
    } finally {
      setIsSearchingUsers(false);
    }
  };

  useEffect(() => {
    if (!hasAdminAccess) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadUsers(adminUserQuery);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [adminUserQuery, hasAdminAccess]);

  const handleViewUser = (user: AdminUserSearchResult) => {
    navigate(`/profile/${user.username}`);
  };

  const handleDeleteConfirmation = (user: AdminUserSearchResult) => {
    setPendingDeleteUser(user);
  };

  const handleDeleteUser = async () => {
    if (!pendingDeleteUser) {
      return;
    }

    setDeletingUserId(pendingDeleteUser.id);

    try {
      await supabase.from("post_likes").delete().eq("user_id", pendingDeleteUser.id);
      await supabase.from("comments").delete().eq("user_id", pendingDeleteUser.id);
      await supabase.from("posts").delete().eq("author_id", pendingDeleteUser.id);

      const { error: profileError } = await supabase.from("profiles").delete().eq("id", pendingDeleteUser.id);
      if (profileError) {
        throw profileError;
      }

      window.alert("Account deleted successfully.");
      setPendingDeleteUser(null);
      void loadUsers(adminUserQuery);
    } catch (error) {
      console.error("deleteUser error", error);
      window.alert("Failed to delete this account. Please try again.");
    } finally {
      setDeletingUserId(null);
    }
  };

  if (isCheckingAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-500" />
            <p className="text-lg font-semibold text-slate-900">Checking access…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!hasAdminAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            ← Back
          </button>

          <div className="rounded-[32px] border border-white/60 bg-white/70 p-8 text-center shadow-2xl backdrop-blur-2xl">
            <p className="text-lg font-semibold text-slate-900">Sorry, you're not an admin.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-4 pb-16 text-slate-900 sm:p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-white/60 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" />
          ← Back
        </button>

        <div className="rounded-[32px] border border-white/60 bg-white/70 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <h1 className="text-2xl font-semibold text-slate-900">Users</h1>
          </div>

          <input
            value={adminUserQuery}
            onChange={(event) => setAdminUserQuery(event.target.value)}
            placeholder="Search by username or email"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-pink-500"
          />

          <div className="mt-4 space-y-2">
            {isSearchingUsers ? (
              <p className="text-sm text-slate-500">Loading users…</p>
            ) : adminSearchResults.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              adminSearchResults.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
                      {user.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{user.username}</p>
                      <p className="text-sm text-slate-500">{user.email || "No email on file"}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleViewUser(user)}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteConfirmation(user)}
                      disabled={deletingUserId === user.id}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deletingUserId === user.id ? (
                        <span>Deleting...</span>
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {pendingDeleteUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl">
            <p className="text-lg font-semibold text-slate-900">Delete this account?</p>
            <p className="mt-2 text-sm text-slate-600">This action cannot be undone. It will remove:</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-600">
              <li>• profile</li>
              <li>• posts</li>
              <li>• comments</li>
              <li>• likes</li>
            </ul>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteUser(null)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={deletingUserId === pendingDeleteUser.id}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {deletingUserId === pendingDeleteUser.id ? "Deleting..." : "Delete Forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
