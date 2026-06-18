import Navbar from "../components/Navbar";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type User = {
  id: string;
  username: string;
  avatar?: string;
};

type Post = {
  id: string | number;
  author: User;
  text: string;
  likes: number;
  image?: string;
};

type Story = {
  id: number;
  name: string;
  text?: string;
  image?: string;
};

const mockPosts: Post[] = [
  {
    id: "post_001",
    author: { id: "user_002", username: "Jessica" },
    text: "Catchin' sunsets! 🌅 #VibesOnPoint",
    likes: 24,
  },
  {
    id: "post_002",
    author: { id: "user_003", username: "Mike" },
    text: "Lazy day with this lil' cutie 😺 #Chillin'",
    likes: 18,
  },
  {
    id: "post_003",
    author: { id: "user_004", username: "Sarah" },
    text: "Just crushed my workout! Feelin' lit! 💪 #Goals",
    likes: 42,
  },
];

const mockUsers: User[] = [
  { id: "user_002", username: "Jessica" },
  { id: "user_003", username: "Mike" },
  { id: "user_004", username: "Sarah" },
  { id: "user_005", username: "Alex" },
  { id: "user_006", username: "Emma" },
];

const mockStories: Story[] = [
  { id: 1, name: "Jay", text: "🔥" },
  { id: 2, name: "Mike", text: "😎" },
  { id: 3, name: "Sarah", text: "❤️" },
];

export default function Search() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) {
      return { users: [], posts: [], stories: [] };
    }

    const lowercaseQuery = query.toLowerCase();

    const users = mockUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(lowercaseQuery)
    );

    const posts = mockPosts.filter(
      (post) =>
        post.text.toLowerCase().includes(lowercaseQuery) ||
        post.author.username.toLowerCase().includes(lowercaseQuery)
    );

    const stories = mockStories.filter(
      (story) =>
        story.name.toLowerCase().includes(lowercaseQuery) ||
        (story.text && story.text.toLowerCase().includes(lowercaseQuery))
    );

    return { users, posts, stories };
  }, [query]);

  const totalResults =
    results.users.length +
    results.posts.length +
    results.stories.length;

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-100 via-pink-100 to-purple-100">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 pt-32 pb-10">
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search people, posts, stories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full px-6 py-3 rounded-2xl border-2 border-pink-300 focus:border-pink-500 outline-none text-lg placeholder-slate-500"
          />
        </div>

        {query.trim() === "" ? (
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-8 text-center">
            <p className="text-slate-500 text-lg">
              Search for people, posts, or stories...
            </p>
          </div>
        ) : totalResults === 0 ? (
          <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-8 text-center">
            <p className="text-slate-500 text-lg">
              No results found for "{query}"
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* People Section */}
            {results.users.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">
                  👥 People ({results.users.length})
                </h2>
                <div className="space-y-2">
                  {results.users.map((user) => (
                    <div
                      key={user.id}
                      onClick={() =>
                        navigate(`/profile/${user.username}`)
                      }
                      className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-4 cursor-pointer hover:scale-102 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {user.avatar ? (
                          <img
                            src={user.avatar}
                            alt={user.username}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-linear-to-r from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm">
                            {user.username[0]}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-800">
                            {user.username}
                          </p>
                          <p className="text-xs text-slate-500">
                            @{user.username.toLowerCase()}
                          </p>
                        </div>
                        <button className="ml-auto px-4 py-2 bg-pink-500 text-white rounded-full font-semibold text-sm hover:bg-pink-600">
                          Follow
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Posts Section */}
            {results.posts.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">
                  📝 Posts ({results.posts.length})
                </h2>
                <div className="space-y-2">
                  {results.posts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => navigate("/feed")}
                      className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-xl p-4 cursor-pointer hover:scale-102 transition-all"
                    >
                      <div className="flex items-start gap-3">
                        {post.author.avatar ? (
                          <img
                            src={post.author.avatar}
                            alt={post.author.username}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-linear-to-r from-pink-400 via-purple-400 to-blue-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {post.author.username[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800">
                            {post.author.username}
                          </p>
                          <p className="text-slate-700 text-sm mt-1 line-clamp-2">
                            {post.text}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">
                            ❤️ {post.likes} Likes
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stories Section */}
            {results.stories.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-3">
                  📖 Stories ({results.stories.length})
                </h2>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {results.stories.map((story) => (
                    <div
                      key={story.id}
                      onClick={() => navigate("/feed")}
                      className="min-w-40 h-32 shrink-0 relative overflow-hidden rounded-3xl shadow-xl text-white cursor-pointer hover:scale-105 transition bg-linear-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center"
                    >
                      {story.image ? (
                        <img
                          src={story.image}
                          alt={story.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-4xl">
                          {story.text}
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/20"></div>

                      <div className="absolute bottom-3 left-0 right-0 text-center px-2">
                        <p className="font-bold text-sm">
                          {story.name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
