import { Link } from "react-router-dom";
import MessageCard from "../components/MessageCard";

export default function Messages() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-100 to-blue-100 p-6 pb-28">

      <div className="max-w-xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-black">
            DMs 💬
          </h1>

          <p className="text-gray-600 text-lg mt-2">
            See who's hittin' your line 🔥
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white/40 backdrop-blur-2xl border border-white/50 rounded-3xl p-4 shadow-xl mb-6">
          <input
            type="text"
            placeholder="Search the squad..."
            className="w-full bg-transparent outline-none"
          />
        </div>

        {/* Message List */}

        <Link to="/chat" className="block">
          <div className="mb-4">
            <MessageCard
              name="Alex 🟢"
              message="Yo twin, what's good?"
              time="2m"
            />
          </div>
        </Link>

        <Link to="/chat" className="block">
          <div className="mb-4">
            <MessageCard
              name="Emma 🟢"
              message="Check your new pics 🔥"
              time="10m"
            />
          </div>
        </Link>

        <Link to="/chat" className="block">
          <div className="mb-4">
            <MessageCard
              name="Jake"
              message="Pull up later 😎"
              time="1h"
            />
          </div>
        </Link>

        <Link to="/chat" className="block">
          <div className="mb-4">
            <MessageCard
              name="Sarah ❤️"
              message="Family dinner this weekend?"
              time="3h"
            />
          </div>
        </Link>

        <Link to="/chat" className="block">
          <div className="mb-4">
            <MessageCard
              name="Mike 🔥"
              message="Big plans loading..."
              time="Yesterday"
            />
          </div>
        </Link>

      </div>


    </div>
  );
}