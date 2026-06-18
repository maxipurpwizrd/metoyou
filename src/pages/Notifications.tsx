import Navbar from "../components/Navbar";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Notification = {
  id: number;
  type: "like" | "comment" | "view" | "follow";
  user: string;
  avatar?: string;
  message: string;
  postId?: string;
  timestamp: number;
  read: boolean;
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications] = useState<Notification[]>([
    {
      id: 1,
      type: "like",
      user: "Jessica",
      message: "liked your post",
      timestamp: Date.now() - 3600000,
      read: false,
      postId: "post_001",
    },
    {
      id: 2,
      type: "comment",
      user: "Mike",
      message: 'commented: "yo twin 🔥"',
      timestamp: Date.now() - 7200000,
      read: false,
      postId: "post_002",
    },
    {
      id: 3,
      type: "view",
      user: "Sarah",
      message: "viewed your story",
      timestamp: Date.now() - 10800000,
      read: true,
    },
    {
      id: 4,
      type: "follow",
      user: "Alex",
      message: "started following you",
      timestamp: Date.now() - 14400000,
      read: true,
    },
    {
      id: 5,
      type: "like",
      user: "Emma",
      message: "liked your post",
      timestamp: Date.now() - 18000000,
      read: true,
      postId: "post_003",
    },
    {
      id: 6,
      type: "comment",
      user: "Jordan",
      message: 'commented: "amazing! 🔥"',
      timestamp: Date.now() - 21600000,
      read: true,
      postId: "post_001",
    },
  ]);

  const getTimeString = (timestamp: number) => {
    const diff = Date.now() - timestamp;
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
      default:
        return "📢";
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 pt-32 pb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-6">
          Notifications
        </h1>

        {notifications.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-8 text-center">
            <p className="text-slate-500 text-lg">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.postId) {
                    navigate(`/feed`);
                  }
                }}
                className={`bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-4 mb-2 transition-all duration-200 cursor-pointer hover:scale-102 ${
                  !notif.read ? "border-pink-300/50 bg-pink-50/30" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  {notif.avatar ? (
                    <img
                      src={notif.avatar}
                      alt={notif.user}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-linear-to-r from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-white font-bold">
                      {notif.user[0]}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{getEmoji(notif.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-700 font-semibold">
                          <span
                            onClick={() =>
                              navigate(`/profile/${notif.user}`)
                            }
                            className="text-pink-600 hover:text-pink-700 cursor-pointer"
                          >
                            {notif.user}
                          </span>{" "}
                          <span className="text-slate-600">
                            {notif.message}
                          </span>
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-1">
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
