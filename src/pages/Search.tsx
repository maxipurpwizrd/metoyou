import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { searchUsersByUsername } from "../lib/profileApi";

type SearchUser = {
  id: string;
  username: string;
  profilePic: string | null;
};

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim()) {
        setIsLoading(true);
        const results = await searchUsersByUsername(query);
        setUsers(results);
        setHasSearched(true);
        setIsLoading(false);
      } else {
        setUsers([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100 p-6 pb-24">
      <Navbar />

      <div className="max-w-2xl mx-auto pt-20">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-[28px] border-2 border-pink-300 focus:border-pink-500 outline-none text-sm placeholder-slate-500 bg-white/40 backdrop-blur-2xl text-slate-900"
          />
        </div>

        {!hasSearched ? (
          <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[28px] shadow-sm p-6 text-center">
            <p className="text-slate-600 text-base">
              Search for people...
            </p>
          </div>
        ) : isLoading ? (
          <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[28px] shadow-sm p-6 text-center">
            <p className="text-slate-600 text-base">
              Searching...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[28px] shadow-sm p-6 text-center">
            <p className="text-slate-600 text-base">
              No users found
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* People Section */}
            <div>
              <h2 className="text-xl font-bold text-slate-900 mb-4">
                👥 People ({users.length})
              </h2>
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() =>
                      navigate(`/profile/${user.username}`)
                    }
                    className="bg-white/20 backdrop-blur-3xl border border-white/30 rounded-[28px] shadow-sm px-4 py-3 cursor-pointer hover:bg-white/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {user.profilePic ? (
                        <img
                          src={user.profilePic}
                          alt={user.username}
                          className="w-10 h-10 rounded-[20px] object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-[20px] bg-linear-to-r from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                          {user.username[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">
                          {user.username}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                          @{user.username.toLowerCase()}
                        </p>
                      </div>
                      <button className="ml-auto px-3 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full font-semibold text-xs hover:scale-105 transition">
                        Follow
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
