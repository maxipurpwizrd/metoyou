import MessageCard from "../components/MessageCard";

export default function Messages() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-4xl font-bold mb-6">
        DMs 💬
      </h1>

      <MessageCard
        name="Alex"
        message="Yo, what's good?"
        time="2m"
      />

      <MessageCard
        name="Emma"
        message="Check your new pics 🔥"
        time="10m"
      />

      <MessageCard
        name="Jake"
        message="Pull up later 😎"
        time="1h"
      />
    </div>
  );
}