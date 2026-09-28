import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from './supabase';
import { subscribeToMessages } from './messageApi';
import { resolveOrCreateConversation } from './conversationResolver';

vi.mock('./supabase', () => {
  const channel = {
    on: vi.fn(),
    subscribe: vi.fn((handler?: (status: string) => void) => {
      handler?.('SUBSCRIBED');
      return undefined;
    }),
    unsubscribe: vi.fn(),
  };

  return {
    supabase: {
      channel: vi.fn(() => channel),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(),
          })),
        })),
      })),
    },
  };
});

describe('subscribeToMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses a single realtime channel for the same conversation', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();

    const firstChannel = subscribeToMessages('conversation-1', firstCallback);
    const secondChannel = subscribeToMessages('conversation-1', secondCallback);

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(firstChannel).toBe(secondChannel);
  });
});

describe('resolveOrCreateConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the database-owned resolver RPC and never invents a pair-based conversation locally', async () => {
    const mockConversation = { id: 'canonical-conversation-id' };
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockConversation.id, error: null });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: mockConversation, error: null }),
        }),
      }),
    } as any);

    const result = await resolveOrCreateConversation('user-b');

    expect(supabase.rpc).toHaveBeenCalledWith('resolve_or_create_conversation', { p_other_user_id: 'user-b' });
    expect(result).toEqual(mockConversation);
  });
});
