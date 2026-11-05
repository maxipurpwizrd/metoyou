import { createContext, useContext } from "react";
import type { CallType } from "../../types/call";

type StartCallInput = {
  conversationId: string;
  recipientId: string;
  recipientName: string;
  callType: CallType;
};

type NativeCallContextValue = {
  startCall: (input: StartCallInput) => Promise<void>;
  isStartingCall: boolean;
};

export const NativeCallContext = createContext<NativeCallContextValue>({
  isStartingCall: false,
  startCall: async () => {
    throw new Error("Call service is unavailable.");
  },
});

export function useNativeCalls() {
  return useContext(NativeCallContext);
}
