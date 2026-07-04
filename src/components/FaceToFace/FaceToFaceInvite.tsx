import { useState } from "react";
import type { Message } from "../../lib/messageApi";

type Props = {
  message: Message;
  isMine?: boolean;
  onAccept: () => void;
};

export default function FaceToFaceInvite({ message, isMine = false, onAccept }: Props) {
  const [isBouncing, setIsBouncing] = useState(false);
  const inviteName = String(message.sender_id ?? "your partner");

  return (
    <div
      className={`rounded-3xl border p-4 shadow-lg transition-all duration-300 ${
        isMine ? "bg-cyan-500/10 border-cyan-400/30 text-white" : "bg-white/90 border-slate-200 text-slate-900"
      } ${isBouncing ? "animate-bounce" : ""}`}
      onMouseEnter={() => setIsBouncing(true)}
      onMouseLeave={() => setIsBouncing(false)}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/face-to-face-button.png"
            alt="FaceToFace"
            className="h-20 w-20 rounded-full object-contain shadow-2xl"
          />
          <div className="text-sm font-semibold">Accept FaceToFace session with {inviteName}</div>
        </div>

        {!isMine ? (
          <button
            type="button"
            onClick={onAccept}
            className="mt-2 rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition"
          >
            Accept FaceToFace
          </button>
        ) : (
          <div className="rounded-3xl bg-slate-950/95 px-4 py-3 text-sm text-white">
            Waiting for {inviteName} to accept your invitation.
          </div>
        )}

        <div className="text-[11px] text-slate-500 text-right">{new Date(message.created_at).toLocaleString()}</div>
      </div>
    </div>
  );
}
