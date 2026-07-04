import { useMemo } from "react";
import type { Message } from "../lib/messageApi";

type Props = {
  message: Message;
  isMine?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
};

export default function FaceToFaceInvite({ message, isMine = false, onAccept, onDecline }: Props) {
  const inviteName = String(message.sender_id ?? "your partner");
  const status = String(message.face_to_face_status ?? "pending");

  const actionLabel = useMemo(() => {
    if (isMine) {
      return status === "pending" ? "Waiting for a response" : "FaceToFace invitation sent";
    }
    if (status === "pending") {
      return `${inviteName} is inviting you to FaceToFace.`;
    }
    return status === "declined" ? "Invitation declined." : "FaceToFace session started.";
  }, [inviteName, isMine, status]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/85 p-4 shadow-xl backdrop-blur-xl text-white transition-all duration-300">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-cyan-500/10 text-cyan-200">
          <img src="/hand-holding-phone.png" alt="FaceToFace" className="h-10 w-10 object-contain" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-semibold">FaceToFace invitation</div>
          <div className="text-sm text-slate-300">{actionLabel}</div>
        </div>
      </div>

      {isMine ? (
        <div className="mt-4 rounded-3xl bg-white/5 px-4 py-3 text-sm text-slate-300">Your invitation is pending.</div>
      ) : (
        status === "pending" && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onAccept}
              className="rounded-2xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={onDecline}
              className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Decline
            </button>
          </div>
        )
      )}

      <div className="mt-4 text-right text-[11px] text-slate-500">
        {new Date(message.created_at).toLocaleString()}
      </div>
    </div>
  );
}
