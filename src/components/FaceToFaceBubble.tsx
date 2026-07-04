import type { Message } from "../lib/messageApi";

type Props = {
  message: Message;
  onAccept: () => void;
  onDecline: () => void;
};

export default function FaceToFaceBubble({ message, onAccept, onDecline }: Props) {
  const senderName = String(message.sender_id ?? "Someone");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm pointer-events-none">
      <div className="pointer-events-auto animate-shake max-w-md rounded-4xl border border-cyan-300/15 bg-slate-950/95 p-6 text-white shadow-2xl">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-900/90 border border-white/10">
            <img
              src="/hand-holding-phone.png"
              alt="FaceToFace invite"
              className="h-16 w-16 object-contain"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.24em] text-cyan-300/80">Incoming FaceToFace</p>
            <h3 className="text-xl font-semibold text-white">{senderName} wants to start a FaceToFace session</h3>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onAccept}
            className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
