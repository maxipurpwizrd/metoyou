import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getNotifications, markNotificationsRead, subscribeToNotifications, type Notification } from "../lib/notificationApi";

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user || typeof user !== "object" || !("id" in user)) return;
    const userId = (user as any).id as string;

    let channel: ReturnType<typeof subscribeToNotifications> | undefined;

    const refreshNotifications = () => {
      void getNotifications(userId).then((data) => setNotifications(data));
    };

    refreshNotifications();
    void markNotificationsRead(userId);
    channel = subscribeToNotifications(userId, refreshNotifications);

    return () => {
      channel?.unsubscribe();
    };
  }, [user]);

  const getTimeString = (timestamp: string | number) => {
    const numericTimestamp = typeof timestamp === "string" ? Number(timestamp) : timestamp;
    if (!Number.isFinite(numericTimestamp)) return "just now";

    const diff = Date.now() - numericTimestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const getEmoji = (type: string) => {
    switch (type) {
      case "like":
        return "❤️";
      case "comment":
        return "💬";
      case "view":
        return "👀";
      case "follow":
        return "👤";
      case "follow_back":
        return "🤝";
      default:
        return "📢";
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6">
      <Navbar />

      <div className="max-w-2xl mx-auto pt-20 pb-24">
        <h1 className="text-4xl sm:text-5xl font-black text-slate-950 mb-8">
          Notifications
        </h1>

        {notifications.length === 0 ? (
          <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl shadow-2xl p-10 text-center">
            <p className="text-slate-600 text-lg">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.postId) {
                    navigate(`/feed`);
                  }
                }}
                className={`bg-white/20 backdrop-blur-3xl border border-white/30 rounded-4xl shadow-2xl px-5 py-4 transition-all duration-200 cursor-pointer hover:bg-white/30 ${
                  !notif.read ? "border-pink-400/50 bg-pink-50/20" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {notif.avatar ? (
                    <img
                      src={notif.avatar}
                      alt={notif.user}
                      className="w-11 h-11 rounded-2xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-linear-to-r from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {notif.user[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getEmoji(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 font-semibold">
                          <span
                            onClick={() =>
                              navigate(`/profile/${notif.user}`)
                            }
                            className="text-pink-600 hover:text-pink-700 cursor-pointer"
                          >
                            {notif.user}
                          </span>
                          <span className="text-slate-700">
                            {" "}{notif.message}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-2">
                      {getTimeString(notif.timestamp)}
                    </p>
                  </div>

                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-pink-500 shrink-0"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
