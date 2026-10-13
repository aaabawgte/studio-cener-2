import type { StudioOverview } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

export const fetchStudioOverview = (slug: string, signal?: AbortSignal) =>
  apiFetch<StudioOverview>(`/api/studios/${encodeURIComponent(slug)}/overview`, { signal });
