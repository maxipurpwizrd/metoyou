import { Link } from "react-router-dom";

export default function Home() {
  return (
    <>

      <div className="app-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 overflow-hidden">

        {/* Hero */}
        <section className="px-6 py-20 text-center">

          <div className="max-w-5xl mx-auto">

            <div className="inline-flex px-5 py-2 rounded-full bg-white/40 backdrop-blur-2xl border border-white/50 shadow-xl mb-8">
              🔥 The Family Social Network
            </div>

            <h1 className="text-7xl md:text-8xl font-black text-gray-800 mb-6">
              MeToYou 💜
            </h1>

            <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto mb-10">
              Connect families, friends and communities worldwide.
              Share memories, catch vibes, create moments and stay close
              no matter where life takes you.
            </p>

            <div className="flex flex-wrap justify-center gap-4">

              <Link
                to="/feed"
                className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-8 py-4 rounded-2xl font-bold shadow-xl hover:scale-105 transition"
              >
                Enter MeToYou 🚀
              </Link>

              <button className="bg-white/40 backdrop-blur-2xl border border-white/50 px-8 py-4 rounded-2xl font-bold shadow-xl">
                Learn More ✨
              </button>

            </div>

          </div>

        </section>

        {/* Showcase Cards */}
        <section className="px-6 pb-20">

          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">💬</div>

              <h2 className="text-2xl font-bold mb-3">
                Real Conversations
              </h2>

              <p className="text-gray-700">
                Stay connected through messages, family chats and community groups.
              </p>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">❤️</div>

              <h2 className="text-2xl font-bold mb-3">
                Family First
              </h2>

              <p className="text-gray-700">
                Built to keep families close no matter where they are in the world.
              </p>
            </div>

            <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-8 shadow-xl">
              <div className="text-5xl mb-4">🌍</div>

              <h2 className="text-2xl font-bold mb-3">
                Global Communities
              </h2>

              <p className="text-gray-700">
                Meet new people, build communities and share your journey.
              </p>
            </div>

          </div>

        </section>

        {/* Vision */}
        <section className="px-6 pb-24">

          <div className="max-w-4xl mx-auto bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-10 shadow-xl text-center">

            <h2 className="text-4xl font-black mb-6">
              More Than Social Media
            </h2>

            <p className="text-lg text-gray-700 leading-relaxed">
              MeToYou isn't about chasing likes.
              It's about bringing people together.
              Families. Friends. Communities.
              Real people sharing real moments.
            </p>

          </div>

        </section>

      </div>

    </>
  );
}