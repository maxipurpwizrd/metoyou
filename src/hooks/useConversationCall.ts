import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface UseConversationCallOptions {
  conversationId: string | null;
  userId: string | null;
  onOffer?: (payload: any) => void;
  onAnswer?: (payload: any) => void;
  onIceCandidate?: (payload: any) => void;
  onHangup?: () => void;
}

export function useConversationCall({ conversationId, userId, onOffer, onAnswer, onIceCandidate, onHangup }: UseConversationCallOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase.channel(`calls:${conversationId}`);

    channel.on("broadcast", { event: "call-offer" }, async (payload) => {
      const eventPayload = payload.payload as any;
      if (!eventPayload?.senderId || !eventPayload?.recipientId || eventPayload.recipientId !== userId) return;
      if (onOffer) onOffer(eventPayload);
    });

    channel.on("broadcast", { event: "call-answer" }, async (payload) => {
      const eventPayload = payload.payload as any;
      if (!eventPayload?.senderId || !eventPayload?.recipientId || eventPayload.recipientId !== userId) return;
      if (onAnswer) onAnswer(eventPayload);
    });

    channel.on("broadcast", { event: "call-ice-candidate" }, async (payload) => {
      const eventPayload = payload.payload as any;
      if (!eventPayload?.senderId || !eventPayload?.recipientId || eventPayload.recipientId !== userId) return;
      if (onIceCandidate) onIceCandidate(eventPayload);
    });

    channel.on("broadcast", { event: "call-hangup" }, () => {
      if (onHangup) onHangup();
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      try {
        if (channelRef.current) {
          void channelRef.current.unsubscribe();
          channelRef.current = null;
        }
      } catch (err) {
        console.warn("useConversationCall unsubscribe failed", err);
      }
    };
  }, [conversationId, userId, onOffer, onAnswer, onIceCandidate, onHangup]);

  const sendCallSignal = async (event: string, payload: Record<string, unknown>) => {
    if (!channelRef.current) return;
    try {
      await channelRef.current.send({ type: "broadcast", event, payload });
    } catch (err) {
      console.warn("sendCallSignal failed", err);
    }
  };

  return { sendCallSignal };
}
