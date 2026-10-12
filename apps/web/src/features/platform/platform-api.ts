import type { InvitationAccepted, LicenseUpdate, PlatformStudio, PlatformStudioCreate, PlatformStudioCreated } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';

export function fetchPlatformStudios(signal?: AbortSignal) {
  return apiFetch<{ studios: PlatformStudio[] }>('/api/platform/studios', { signal });
}

export function createPlatformStudio(input: PlatformStudioCreate) {
  return apiFetch<PlatformStudioCreated>('/api/platform/studios', { method: 'POST', body: input });
}

export function acceptInvitation(token: string) {
  return apiFetch<InvitationAccepted>('/api/invitations/accept', { method: 'POST', body: { token } });
}

export function updateStudioLicense(studioId: string, input: LicenseUpdate) {
  return apiFetch<PlatformStudio>(`/api/platform/studios/${encodeURIComponent(studioId)}/license`, { method: 'PUT', body: input });
}
