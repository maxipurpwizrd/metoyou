import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { platform } = vi.hoisted(() => ({ platform: { OS: 'android' } }));

vi.mock('react-native', () => ({ Platform: platform }));

describe('notification sounds', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    platform.OS = 'android';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the repo message tone for message and notification alerts', () => {
    return import('./notificationSound').then(({ getMessageSoundUrl }) => {
      expect(getMessageSoundUrl()).toMatch(/Messagetone\.mp3|Messagestone\.mp3/);
    });
  });

  it('uses the ringtone for call alerts', () => {
    return import('./notificationSound').then(({ getCallSoundUrl }) => {
      expect(getCallSoundUrl()).toBe('/Ringtone.mp3');
    });
  });

  it('does not access browser APIs on Android when they are unavailable', async () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('Audio', undefined);

    const sounds = await import('./notificationSound');
    expect(() => sounds.playMessageNotificationSound()).not.toThrow();
    expect(() => sounds.playCallRingtone()).not.toThrow();
    expect(() => sounds.stopCallRingtone()).not.toThrow();
  });

  it('registers and removes browser audio unlock listeners on web', async () => {
    platform.OS = 'web';
    const audio = {
      currentTime: 0,
      loop: false,
      muted: false,
      pause: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      preload: '',
    };
    const audioFactory = vi.fn(function AudioMock() {
      return audio;
    });
    vi.stubGlobal('Audio', audioFactory);
    const addEventListener = vi.spyOn(window, 'addEventListener');
    const removeEventListener = vi.spyOn(window, 'removeEventListener');

    const sounds = await import('./notificationSound');

    expect(addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), {
      once: true,
      passive: true,
    });
    expect(addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function), { once: true });

    window.dispatchEvent(new Event('pointerdown'));
    expect(removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(audio.play).toHaveBeenCalledOnce();

    sounds.playCallRingtone();
    expect(audioFactory).toHaveBeenCalledWith('/Ringtone.mp3');
    expect(audio.play).toHaveBeenCalledTimes(2);
    sounds.stopCallRingtone();
    expect(audio.pause).toHaveBeenCalledOnce();
  });
});
