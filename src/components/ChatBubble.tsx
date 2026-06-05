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
      className={`max-w-xs p-4 rounded-3xl mb-3 ${
        mine
          ? "bg-blue-500 text-white ml-auto"
          : "bg-pink-500 text-white"
      }`}
    >
      {text}
    </div>
  );
}