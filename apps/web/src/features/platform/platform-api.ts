import type { InvitationAccepted, LicenseUpdate, PlatformDomainWrite, PlatformStudio, PlatformStudioCreate, PlatformStudioCreated, PublicDomainResolution } from '@studio/contracts';
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

export function setStudioDomain(studioId: string, input: PlatformDomainWrite) {
  return apiFetch<PlatformStudio>(`/api/platform/studios/${encodeURIComponent(studioId)}/domain`, { method: 'PUT', body: input });
}

export function verifyStudioDomain(studioId: string) {
  return apiFetch<PlatformStudio>(`/api/platform/studios/${encodeURIComponent(studioId)}/domain/verify`, { method: 'POST' });
}

export function resolveCustomDomain(hostname: string, signal?: AbortSignal) {
  return apiFetch<PublicDomainResolution>(`/api/public/domains/resolve?hostname=${encodeURIComponent(hostname)}`, { signal });
}
