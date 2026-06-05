import ChatBubble from "../components/ChatBubble";

export default function Chat() {
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold mb-6">
        Chat 🔥
      </h1>

      <ChatBubble mine text="What's good bro?" />
      <ChatBubble text="Chillin 😎" />
      <ChatBubble mine text="You free later?" />
      <ChatBubble text="Yeah, let's link up." />
    </div>
  );
}