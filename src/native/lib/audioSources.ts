export type NativeAudioQueueTrack = {
  id?: string;
  audio_url?: string | null;
  text?: string | null;
  username?: string | null;
  image_url?: string | null;
};

export function toNativeAudioSource(track: NativeAudioQueueTrack) {
  const uri = typeof track.audio_url === 'string' ? track.audio_url.trim() : '';
  if (!uri) return null;

  return {
    uri,
    name: track.text?.trim() || 'Track',
  };
}
