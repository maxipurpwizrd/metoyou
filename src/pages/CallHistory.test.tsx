import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CallHistory from './CallHistory';

const mockUseAuth = vi.fn();
const mockUseSession = vi.fn();
const mockUseAppInit = vi.fn();
const mockUseLanguage = vi.fn();
const mockGetCallHistory = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('../contexts/SessionContext', () => ({
  useSession: () => mockUseSession(),
}));

vi.mock('../contexts/AppInitContext', () => ({
  useAppInit: () => mockUseAppInit(),
}));

vi.mock('../contexts/LanguageContext', () => ({
  useLanguage: () => mockUseLanguage(),
}));

vi.mock('../lib/callHistoryApi', () => ({
  getCallHistory: (...args: unknown[]) => mockGetCallHistory(...args),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(async () => ({ data: [{ id: 'other-user', username: 'alice' }], error: null })),
      })),
    })),
  },
}));

describe('CallHistory', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: { id: 'me' } });
    mockUseSession.mockReturnValue({ profileReady: true, profile: { id: 'me' } });
    mockUseAppInit.mockReturnValue({ appReady: true });
    mockUseLanguage.mockReturnValue({
      t: (key: string) => ({
        'callHistory.title': 'Call history',
        'callHistory.description': 'Your recent calls will appear here.',
        'callHistory.back': 'Back',
        'callHistory.loading': 'Loading call history...',
        'callHistory.empty': 'No calls yet',
        'callHistory.emptyDescription': 'Completed and missed calls will be listed here.',
        'callHistory.completed': 'Completed',
        'callHistory.missed': 'Missed',
        'callHistory.declined': 'Declined',
        'callHistory.failed': 'Failed',
        'callHistory.connected': 'Connected',
        'callHistory.ringing': 'Ringing',
        'callHistory.outgoing': 'Outgoing',
        'callHistory.incoming': 'Incoming',
        'calls.startAudio': 'Start audio call',
        'calls.startVideo': 'Start video call',
        'calls.chooseType': 'Choose a call type',
        'profile.cancel': 'Cancel',
      }[key] ?? key),
    });

    mockGetCallHistory.mockResolvedValue([
      {
        id: 'call-1',
        conversation_id: 'conversation-1',
        caller_id: 'me',
        recipient_id: 'other-user',
        call_type: 'audio',
        status: 'completed',
        started_at: '2024-01-01T00:00:00.000Z',
        answered_at: '2024-01-01T00:00:01.000Z',
        ended_at: '2024-01-01T00:00:02.000Z',
        duration_seconds: 42,
        created_at: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('opens a call type chooser when a history item is clicked', async () => {
    render(
      <MemoryRouter>
        <CallHistory />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('alice'));

    expect(screen.getByText('Choose a call type')).toBeInTheDocument();
    expect(screen.getByText('Start audio call')).toBeInTheDocument();
    expect(screen.getByText('Start video call')).toBeInTheDocument();
  });
});
