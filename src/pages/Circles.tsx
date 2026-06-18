
export default function Circles() {
  const circles = [
    {
      name: "Family ❤️",
      members: 24,
      emoji: "❤️",
    },
    {
      name: "Besties 🔥",
      members: 12,
      emoji: "🔥",
    },
    {
      name: "Builders 🚀",
      members: 38,
      emoji: "🚀",
    },
    {
      name: "Gamers 🎮",
      members: 56,
      emoji: "🎮",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pb-28">

      <div className="max-w-xl mx-auto">

        <h1 className="text-5xl font-black mb-2">
          Circles ❤️
        </h1>

        <p className="text-gray-600 mb-8">
          Your people. Your communities.
        </p>

        <div className="space-y-4">

          {circles.map((circle) => (
            <div
              key={circle.name}
              className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-6 shadow-xl"
            >
              <div className="flex justify-between items-center">

                <div>
                  <h2 className="font-bold text-xl">
                    {circle.name}
                  </h2>

                  <p className="text-gray-600">
                    {circle.members} members
                  </p>
                </div>

                <div className="text-4xl">
                  {circle.emoji}
                </div>

              </div>
            </div>
          ))}

        </div>

      </div>


    </div>
  );
}