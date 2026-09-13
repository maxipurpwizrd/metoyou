import { render, screen } from '@testing-library/react';
import { useAdminReports } from './useAdminReports';
import { createMockAdminReportsService } from '../services/mock/adminReportService';

const mockData = {
  reports: [
    { id: 'r1', reason: 'spam', created_at: '2026-08-03T00:00:00Z', status: 'pending', report_type: 'post', post_id: 'p1', reporter_id: 'u1', reported_user_id: 'u2' },
  ],
  posts: [{ id: 'p1', text: 'Hello world', image_url: null }],
  profiles: [
    { id: 'u1', username: 'reporter' },
    { id: 'u2', username: 'reported' },
  ],
};

type TestProps = { reportsService: ReturnType<typeof createMockAdminReportsService> };

function TestComponent({ reportsService }: TestProps) {
  const {
    reportedPosts,
    loadReportedPosts,
    reportedPostsError,
    isLoadingReportedPosts,
  } = useAdminReports(reportsService);

  return (
    <div>
      <button type="button" onClick={() => void loadReportedPosts()}>
        Load
      </button>
      <div data-testid="loading">{isLoadingReportedPosts ? 'loading' : 'idle'}</div>
      <div data-testid="error">{reportedPostsError ?? 'no-error'}</div>
      <ul>
        {reportedPosts.map((item) => (
          <li key={item.reportId}>{item.reportReason}</li>
        ))}
      </ul>
    </div>
  );
}

describe('useAdminReports', () => {
  it('loads reported posts from the mock admin reports service', async () => {
    const reportsService = createMockAdminReportsService(mockData as any);
    render(<TestComponent reportsService={reportsService} />);

    const loadButton = screen.getByRole('button', { name: /load/i });
    await screen.findByText(/load/i); // ensure component mounted
    await loadButton.click();

    expect(await screen.findByText(/spam/i)).toBeInTheDocument();
    expect(screen.getByTestId('error')).toHaveTextContent('no-error');
    expect(screen.getByTestId('loading')).toHaveTextContent('idle');
  });
});
