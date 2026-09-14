import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { RealtimeChannel } from "@supabase/supabase-js";
import IncomingCall from "../components/calls/IncomingCall";
import { useAuth } from "../hooks/useAuth";
import { updateCallHistory } from "../lib/callHistoryApi";
import { supabase } from "../lib/supabase";

export type PendingIncomingCall = {
  conversationId: string;
  senderId: string;
  senderName: string;
  callType: "audio" | "video";
  callId?: string;
  sdp: RTCSessionDescriptionInit;
};

type GlobalCallContextValue = {
  pendingIncomingCall: PendingIncomingCall | null;
  clearPendingIncomingCall: () => void;
};

const GlobalCallContext = createContext<GlobalCallContextValue | undefined>(undefined);

export function GlobalCallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingIncomingCall, setPendingIncomingCall] = useState<PendingIncomingCall | null>(null);
  const pendingIncomingCallRef = useRef<PendingIncomingCall | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const [isChatOpenForCaller, setIsChatOpenForCaller] = useState(false);

  useEffect(() => {
    const recipientId = new URLSearchParams(location.search).get("recipient");
    setIsChatOpenForCaller(location.pathname === "/chat" && recipientId === pendingIncomingCall?.senderId);
  }, [location.pathname, location.search, pendingIncomingCall?.senderId]);

  useEffect(() => {
    if (!pendingIncomingCall) {
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      }
      return;
    }

    const ringtone = ringtoneRef.current ?? new Audio("/Ringtone.mp3");
    ringtone.loop = true;
    ringtone.volume = 0.8;
    ringtoneRef.current = ringtone;
    void ringtone.play().catch(() => {
      // Browser autoplay policies may block incoming-call playback.
    });

    return () => {
      ringtone.pause();
      ringtone.currentTime = 0;
    };
  }, [pendingIncomingCall]);

  useEffect(() => {
    if (!user?.id) {
      pendingIncomingCallRef.current = null;
      setPendingIncomingCall(null);
      return;
    }

    let cancelled = false;
    const channels = new Map<string, RealtimeChannel>();

    const subscribeToUserCalls = async () => {
      const { data: conversations, error } = await supabase
        .from("conversations")
        .select("id")
        .or(`user_1.eq.${user.id},user_2.eq.${user.id}`);

      if (cancelled || error) {
        if (error) console.warn("Global call conversation lookup failed", error);
        return;
      }

      for (const conversation of conversations ?? []) {
        const conversationId = conversation.id as string;
        if (channels.has(conversationId)) continue;

        const channel = supabase.channel(`calls:${conversationId}`);
        channel.on("broadcast", { event: "call-offer" }, (event) => {
          const payload = event.payload as Partial<PendingIncomingCall> & { recipientId?: string };
          if (
            payload.recipientId !== user.id ||
            !payload.senderId ||
            !payload.sdp ||
            !payload.callType ||
            pendingIncomingCallRef.current
          ) {
            return;
          }

          const incomingCall = {
            conversationId,
            senderId: payload.senderId,
            senderName: payload.senderName ?? "Someone",
            callType: payload.callType,
            callId: payload.callId,
            sdp: payload.sdp,
          } satisfies PendingIncomingCall;
          pendingIncomingCallRef.current = incomingCall;
          setPendingIncomingCall(incomingCall);
        });

        channel.on("broadcast", { event: "call-hangup" }, (event) => {
          const payload = event.payload as { senderId?: string; recipientId?: string };
          const currentCall = pendingIncomingCallRef.current;
          if (
            payload.recipientId === user.id &&
            currentCall?.conversationId === conversationId &&
            currentCall.senderId === payload.senderId
          ) {
            pendingIncomingCallRef.current = null;
            setPendingIncomingCall(null);
          }
        });

        channel.subscribe();
        channels.set(conversationId, channel);
      }
    };

    void subscribeToUserCalls();

    const refreshSubscriptions = () => {
      void subscribeToUserCalls();
    };
    window.addEventListener("focus", refreshSubscriptions);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshSubscriptions);
      for (const channel of channels.values()) {
        void channel.unsubscribe();
      }
    };
  }, [user?.id]);

  const clearPendingIncomingCall = useCallback(() => {
    pendingIncomingCallRef.current = null;
    setPendingIncomingCall(null);
  }, []);

  const handleAccept = () => {
    if (!pendingIncomingCall) return;
    const call = pendingIncomingCall;
    navigate(`/chat?recipient=${call.senderId}&username=${encodeURIComponent(call.senderName)}`);
  };

  const handleReject = async () => {
    if (!pendingIncomingCall || !user?.id) return;
    const callChannel = supabase.channel(`calls:${pendingIncomingCall.conversationId}`);
    await callChannel.subscribe();
    await callChannel.send({
      type: "broadcast",
      event: "call-hangup",
      payload: { senderId: user.id, recipientId: pendingIncomingCall.senderId },
    });
    await callChannel.unsubscribe();
    void updateCallHistory(pendingIncomingCall.callId ?? null, {
      status: "declined",
      ended_at: new Date().toISOString(),
      duration_seconds: 0,
    });
    pendingIncomingCallRef.current = null;
    setPendingIncomingCall(null);
  };

  const contextValue = useMemo(() => ({
    pendingIncomingCall,
    clearPendingIncomingCall,
  }), [pendingIncomingCall]);

  return (
    <GlobalCallContext.Provider value={contextValue}>
      {children}
      {pendingIncomingCall && !isChatOpenForCaller && (
        <IncomingCall
          senderName={pendingIncomingCall.senderName}
          callType={pendingIncomingCall.callType}
          onAccept={handleAccept}
          onReject={() => void handleReject()}
        />
      )}
    </GlobalCallContext.Provider>
  );
}

export function useGlobalCall() {
  const context = useContext(GlobalCallContext);
  if (!context) throw new Error("useGlobalCall must be used within GlobalCallProvider");
  return context;
}
