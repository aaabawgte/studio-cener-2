import type { ProfileUpdate, Viewer } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

export const updateProfile = (slug: string, input: ProfileUpdate) =>
  apiFetch<Viewer>(`/api/studios/${encodeURIComponent(slug)}/profile`, { method: 'PUT', body: input });
