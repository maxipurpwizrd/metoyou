type Props = {
  name: string;
  message: string;
  time: string;
};

export default function MessageCard({
  name,
  message,
  time,
}: Props) {
  return (
    <div className="bg-white rounded-3xl p-4 shadow mb-4">
      <div className="flex justify-between">
        <h3 className="font-bold">
          {name}
        </h3>

        <span className="text-sm text-gray-500">
          {time}
        </span>
      </div>

      <p>{message}</p>
    </div>
  );
}