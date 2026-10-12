import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';
import type { StudioViewerContext } from './types';

/**
 * GET /api/studios/:slug/viewer-context
 * 200 → StudioViewerContext · 401 → nije prijavljen · 403 → nije član · 404 → studio ne postoji
 */
export async function fetchStudioViewerContext(slug: string, signal: AbortSignal): Promise<StudioViewerContext> {
  if (USE_MOCKS) {
    const { mockStudioViewerContext } = await import('../../mocks/studio-context');
    return mockStudioViewerContext(slug, signal);
  }
  return apiFetch<StudioViewerContext>(`/api/studios/${encodeURIComponent(slug)}/viewer-context`, { signal });
}
