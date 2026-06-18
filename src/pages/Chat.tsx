import { Link } from "react-router-dom";
import ChatBubble from "../components/ChatBubble";

export default function Chat() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pb-28">

      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-4 shadow-xl mb-6 flex items-center gap-4">

          <Link
            to="/messages"
            className="text-xl font-bold"
          >
            ←
          </Link>

          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center text-white font-bold">
            A
          </div>

          <div>
            <h2 className="font-bold text-lg">
              Alex 🟢
            </h2>

            <p className="text-sm text-gray-600">
              Online now
            </p>
          </div>

        </div>

        {/* Messages */}
        <div className="space-y-4 mb-6">

          <ChatBubble mine text="Yo twin 🔥" />
          <ChatBubble text="Wassup gang 😎" />
          <ChatBubble mine text="You free later?" />
          <ChatBubble text="Bet 💯" />
          <ChatBubble mine text="Pulling up around 7" />
          <ChatBubble text="Say less 😂🔥" />

        </div>

        {/* Message Box */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-4 shadow-xl flex gap-3">

          <input
            type="text"
            placeholder="Type a message..."
            className="flex-1 bg-transparent outline-none"
          />

          <button className="bg-gradient-to-r from-pink-500 to-purple-500 text-white px-5 py-2 rounded-2xl font-bold shadow-lg hover:scale-105 transition">
            Send 🚀
          </button>

        </div>

      </div>


    </div>
  );
}