type Props = {
  text: string;
  mine?: boolean;
};

export default function ChatBubble({
  text,
  mine,
}: Props) {
  return (
    <div
      className={`flex ${
        mine ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-xs md:max-w-sm px-5 py-3 rounded-3xl shadow-lg mb-3 ${
          mine
            ? "bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-br-lg"
            : "bg-white/50 backdrop-blur-2xl border border-white/50 text-gray-800 rounded-bl-lg"
        }`}
      >
        {text}
      </div>
    </div>
  );
}