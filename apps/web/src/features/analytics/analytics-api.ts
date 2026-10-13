import type { AnalyticsRange, StudioAnalytics } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

export const fetchStudioAnalytics = (slug: string, range: AnalyticsRange, signal?: AbortSignal) => {
  const query = new URLSearchParams({ range });
  return apiFetch<StudioAnalytics>(`/api/studios/${encodeURIComponent(slug)}/analytics?${query}`, { signal });
};
