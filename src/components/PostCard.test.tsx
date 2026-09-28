import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PostCard from './PostCard';

vi.mock('../contexts/SessionContext', () => ({
  useSession: () => ({
    profile: { id: 'viewer-1', username: 'viewer' },
  }),
}));

vi.mock('../hooks/useAutoplayVideo', () => ({
  useAutoplayVideo: () => ({ isVisible: true }),
}));

vi.mock('../hooks/useAutoplayAudio', () => ({
  useAutoplayAudio: () => ({ isVisible: true }),
}));

vi.mock('../contexts/VideoContext', () => ({
  useVideoContext: () => ({
    isMuted: false,
    setMuted: vi.fn(),
  }),
}));

describe('PostCard moderation actions', () => {
  it('uses the block callback instead of a local mute callback when blocking an author', () => {
    const onBlockUser = vi.fn();
    const onMuteUser = vi.fn();

    render(
      <MemoryRouter>
        <PostCard
          author={{ id: 'author-1', username: 'author', is_vibes_pro: false }}
          time="2h ago"
          text="Hello world"
          likes={10}
          onBlockUser={onBlockUser}
          onMuteUser={onMuteUser}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(screen.getByText('Block author'));

    expect(onBlockUser).toHaveBeenCalledTimes(1);
    expect(onMuteUser).not.toHaveBeenCalled();
  });
});
