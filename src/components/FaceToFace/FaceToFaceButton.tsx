import type { MouseEventHandler } from "react";

type Props = {
  onClick: MouseEventHandler<HTMLButtonElement>;
};

export default function FaceToFaceButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-white/10 border border-white/15 p-3 hover:bg-white/15 transition"
      title="FaceToFace"
    >
      <span className="text-2xl">📱🤝</span>
    </button>
  );
}
