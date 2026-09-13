import { renderHook, act } from '@testing-library/react';
import { createMockAdminReportsService } from '../services/mock/adminReportService';
import { useAdminReports } from './useAdminReports';

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

describe('useAdminReports', () => {
  it('loads reported posts from the mock admin reports service', async () => {
    const mockService = createMockAdminReportsService(mockData as any);
    const { result } = renderHook(() => useAdminReports(mockService));

    await act(async () => {
      await result.current.loadReportedPosts();
    });

    expect(result.current.reportedPosts).toEqual([
      expect.objectContaining({
        reportId: 'r1',
        reportReason: 'spam',
        reporterUsername: 'reporter',
        reportedUsername: 'reported',
        postPreview: 'Hello world',
      }),
    ]);
    expect(result.current.reportedPostsError).toBeNull();
    expect(result.current.isLoadingReportedPosts).toBe(false);
  });
});
