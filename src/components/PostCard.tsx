type Props = {
  name: string;
  time: string;
  text: string;
};

export default function PostCard({
  name,
  time,
  text,
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-5 shadow mb-6">
      <h3 className="font-bold text-xl">
        {name}
      </h3>

      <p className="text-gray-500 text-sm mb-3">
        {time}
      </p>

      <p>{text}</p>
    </div>
  );
}