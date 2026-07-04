import type { MouseEventHandler } from "react";

type Props = {
  onClick: MouseEventHandler<HTMLButtonElement>;
  visible?: boolean;
};

export default function FaceToFaceButton({ onClick, visible = true }: Props) {
  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <button
        type="button"
        onClick={onClick}
        className={`pointer-events-auto flex h-24 w-24 items-center justify-center rounded-full bg-slate-950/55 backdrop-blur-xl border border-white/15 p-4 shadow-2xl transition-all duration-500 ease-out ${
          visible ? "opacity-80 scale-100" : "opacity-0 scale-90"
        }`}
        title="Start FaceToFace session"
      >
        <img
          src="/hand-holding-phone.png"
          alt="Start FaceToFace session"
          className="h-12 w-12 object-contain"
        />
      </button>
    </div>
  );
}
