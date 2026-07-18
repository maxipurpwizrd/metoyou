import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { searchUsersByUsername } from "../lib/profileApi";
import { getProfile } from "../utils/profileStorage";
import { useProfile } from "../contexts/ProfileContext";
import { VibesProFeed } from "../themes/vibespro";

type SearchUser = {
  id: string;
  username: string;
  profilePic: string | null;
};

export default function Search() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { profile: profileFromContext } = useProfile();
  const profile = profileFromContext ?? getProfile();
  const isVibesPro = profile?.is_vibes_pro === true;
  
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

  const searchContent = (
    <div className={`app-screen ${isVibesPro ? 'bg-[#0B0B0B]' : 'bg-linear-to-br from-blue-100 via-pink-100 to-purple-100'} p-6 pb-24`}>
      {!isVibesPro && <Navbar />}

      <div className={`max-w-2xl mx-auto ${isVibesPro ? 'pt-8' : 'pt-20'}`}>
        <div className="mb-6">
          <input
            type="text"
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`w-full px-4 py-3 rounded-[28px] outline-none text-sm ${
              isVibesPro
                ? 'border-2 border-[#D4AF37]/40 bg-[#181818] placeholder-white/50 text-white focus:border-[#D4AF37]'
                : 'border-2 border-pink-300 bg-white/40 placeholder-slate-500 text-slate-900 focus:border-pink-500'
            } backdrop-blur-2xl`}
          />
        </div>

        {!hasSearched ? (
          <div className={`rounded-[28px] shadow-sm p-6 text-center ${
            isVibesPro
              ? 'bg-[#181818] border border-[#D4AF37]/20'
              : 'bg-white/20 backdrop-blur-3xl border border-white/30'
          }`}>
            <p className={isVibesPro ? 'text-white/70' : 'text-slate-600'}>
              {t("search.empty")}
            </p>
          </div>
        ) : isLoading ? (
          <div className={`rounded-[28px] shadow-sm p-6 text-center ${
            isVibesPro
              ? 'bg-[#181818] border border-[#D4AF37]/20'
              : 'bg-white/20 backdrop-blur-3xl border border-white/30'
          }`}>
            <p className={isVibesPro ? 'text-white/70' : 'text-slate-600'}>
              {t("search.loading")}
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className={`rounded-[28px] shadow-sm p-6 text-center ${
            isVibesPro
              ? 'bg-[#181818] border border-[#D4AF37]/20'
              : 'bg-white/20 backdrop-blur-3xl border border-white/30'
          }`}>
            <p className={isVibesPro ? 'text-white/70' : 'text-slate-600'}>
              {t("search.none")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* People Section */}
            <div>
              <h2 className={`text-xl font-bold mb-4 ${
                isVibesPro ? 'text-white' : 'text-slate-900'
              }`}>
                👥 {t("search.peopleCount").replace("{count}", String(users.length))}
              </h2>
              <div className="space-y-3">
                {users.map((user) => (
                  <div
                    key={user.id}
                    onClick={() =>
                      navigate(`/profile/${user.username}`)
                    }
                    className={`rounded-[28px] shadow-sm px-4 py-3 cursor-pointer transition-all ${
                      isVibesPro
                        ? 'bg-[#181818] border border-[#D4AF37]/20 hover:border-[#D4AF37]/40'
                        : 'bg-white/20 backdrop-blur-3xl border border-white/30 hover:bg-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {user.profilePic ? (
                        <img
                          src={user.profilePic}
                          alt={user.username}
                          className={`w-10 h-10 rounded-[20px] object-cover ${
                            isVibesPro ? 'ring-2 ring-[#D4AF37]/30' : ''
                          }`}
                        />
                      ) : (
                        <div className={`w-10 h-10 rounded-[20px] flex items-center justify-center text-white font-bold text-sm ${
                          isVibesPro
                            ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E]'
                            : 'bg-linear-to-r from-pink-400 via-purple-400 to-blue-400'
                        }`}>
                          {user.username[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${
                          isVibesPro ? 'text-white' : 'text-slate-900'
                        }`}>
                          {user.username}
                        </p>
                        <p className={`text-[10px] mt-1 truncate ${
                          isVibesPro ? 'text-white/50' : 'text-slate-500'
                        }`}>
                          @{user.username.toLowerCase()}
                        </p>
                      </div>
                      <button className={`ml-auto px-3 py-2 rounded-full font-semibold text-xs hover:scale-105 transition ${
                        isVibesPro
                          ? 'bg-linear-to-r from-[#D4AF37] to-[#F0C75E] text-[#0B0B0B]'
                          : 'bg-linear-to-r from-pink-500 to-purple-500 text-white'
                      }`}>
                        {t("search.follow")}
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

  if (isVibesPro) {
    return (
      <VibesProFeed>
        {searchContent}
      </VibesProFeed>
    );
  }

  return searchContent;
}
