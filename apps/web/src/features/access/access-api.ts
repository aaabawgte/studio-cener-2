import type { ManagerInvitationCreate, ManagerInvitationCreated, StudioAccess } from '@studio/contracts';
import { apiFetch } from '../../lib/api/client';
import { USE_MOCKS } from '../../lib/env';

const base = (slug: string) => `/api/studios/${encodeURIComponent(slug)}`;

export async function fetchStudioAccess(slug: string, signal?: AbortSignal) {
  if (USE_MOCKS) return (await import('../../mocks/access')).mockStudioAccess(signal);
  return apiFetch<StudioAccess>(`${base(slug)}/access`, { signal });
}

export async function inviteManager(slug: string, input: ManagerInvitationCreate) {
  if (USE_MOCKS) return (await import('../../mocks/access')).mockInviteManager(input);
  return apiFetch<ManagerInvitationCreated>(`${base(slug)}/manager-invitations`, { method: 'POST', body: input });
}

export async function revokeManagerInvitation(slug: string, invitationId: string) {
  if (USE_MOCKS) return (await import('../../mocks/access')).mockRevokeInvitation(invitationId);
  return apiFetch<void>(`${base(slug)}/manager-invitations/${encodeURIComponent(invitationId)}`, { method: 'DELETE' });
}

export async function revokeManagerAccess(slug: string, membershipId: string) {
  if (USE_MOCKS) return (await import('../../mocks/access')).mockRevokeAccess(membershipId);
  return apiFetch<void>(`${base(slug)}/memberships/${encodeURIComponent(membershipId)}`, { method: 'DELETE' });
}
