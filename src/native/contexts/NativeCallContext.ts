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
};

export const NativeCallContext = createContext<NativeCallContextValue>({
  startCall: async () => {
    throw new Error("Calls require the MeToYou development build.");
  },
});

export function useNativeCalls() {
  return useContext(NativeCallContext);
}
