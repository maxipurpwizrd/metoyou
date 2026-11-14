import { describe, expect, it } from 'vitest';
import { toNativeAudioSource } from './audioSources';

describe('toNativeAudioSource', () => {
  it('wraps a remote track URL in the object shape expo-audio expects', () => {
    expect(toNativeAudioSource({
      id: 'device:1',
      text: 'Night Drive',
      username: 'Demo',
      image_url: null,
      audio_url: 'https://example.com/song.mp3',
    })).toEqual({
      uri: 'https://example.com/song.mp3',
      name: 'Night Drive',
    });
  });
});
