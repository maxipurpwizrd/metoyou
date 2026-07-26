export type CallType = 'audio' | 'video';

export type CallStatus = 'initiating' | 'ringing' | 'connected' | 'ended' | 'failed';

export interface CallSession {
  id: string;
  conversationId: string;
  callType: CallType;
  status: CallStatus;
  startTime?: Date;
  endTime?: Date;
  remoteUserId: string;
  remoteUsername?: string;
  remoteAvatarUrl?: string;
}

export interface CallState {
  isActive: boolean;
  session?: CallSession;
  localStreamActive: boolean;
  remoteStreamActive: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  connectionQuality?: 'excellent' | 'good' | 'fair' | 'poor' | 'failed';
}
