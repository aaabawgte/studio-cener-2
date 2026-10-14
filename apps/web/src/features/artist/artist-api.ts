import type { ArtistOverview } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

export const fetchArtistOverview = (slug: string, signal?: AbortSignal) =>
  apiFetch<ArtistOverview>(`/api/studios/${encodeURIComponent(slug)}/artist-overview`, { signal });
