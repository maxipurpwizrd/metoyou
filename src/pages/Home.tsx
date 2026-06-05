import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-blue-100 to-purple-100 flex flex-col justify-center items-center text-center p-8">
      <h1 className="text-6xl font-bold mb-6">
        MeToYou 💜
      </h1>

      <p className="text-xl text-gray-700 max-w-xl mb-8">
        Connect with your people. Share memories. Catch vibes.
      </p>

      <Link
        to="/feed"
        className="bg-pink-500 text-white px-8 py-4 rounded-2xl font-bold"
      >
        Enter MeToYou 🔥
      </Link>
    </div>
  );
}