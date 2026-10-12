/**
 * DEV MOCK — nikad se ne uključuje u produkcijski build (vidi lib/env.ts USE_MOCKS).
 * Zamjenjuje GET /api/studios/:slug/viewer-context dok endpoint ne postoji.
 *
 * Posebni slugovi za testiranje stanja:
 *   /app/nema/...      → 404
 *   /app/zabranjeno/.. → 403
 *   /app/greska/...    → 500
 *   /app/menadzer/...  → manager bez analitike i postavki
 */
import { ApiError } from '../lib/api/client';
import type { StudioPermission, StudioViewerContext } from '../features/studio/types';

const ALL: StudioPermission[] = [
  'bookings.view',
  'bookings.manage',
  'calendar.manage',
  'services.manage',
  'hours.manage',
  'team.manage',
  'portfolio.manage',
  'analytics.view',
  'studio.settings.manage',
];

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export async function mockStudioViewerContext(slug: string, signal: AbortSignal): Promise<StudioViewerContext> {
  await wait(450, signal);
  if (slug === 'nema') throw new ApiError(404);
  if (slug === 'zabranjeno') throw new ApiError(403);
  if (slug === 'greska') throw new ApiError(500);

  const isManager = slug === 'menadzer';
  return {
    studio: {
      id: 'stu_mock_1',
      slug,
      name: 'Studio Cener',
      timezone: 'Europe/Zagreb',
      currency: 'EUR',
      branding: { accentColor: null, logoUrl: null },
    },
    viewer: {
      userId: 'usr_mock_1',
      name: isManager ? 'Mia Horvat' : 'Bruno Ježek',
      email: 'demo@studio.local',
      avatarUrl: null,
    },
    membership: isManager
      ? { role: 'manager', permissions: ALL.filter((p) => p !== 'analytics.view' && p !== 'studio.settings.manage') }
      : { role: 'owner', permissions: ALL },
  };
}
