import type { ManagerInvitationCreate, ManagerInvitationCreated, StudioAccess } from '@studio/contracts';

let invitations: StudioAccess['invitations'] = [];
const members: StudioAccess['members'] = [{
  membershipId: 'demo-owner-membership', userId: 'demo-owner', name: 'Studio Owner', email: 'owner@example.test',
  role: 'owner', status: 'active', teamMemberId: null, createdAt: new Date().toISOString(),
}];

function wait(signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, 150);
    signal?.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
}

export async function mockStudioAccess(signal?: AbortSignal): Promise<StudioAccess> {
  await wait(signal);
  return { members: structuredClone(members), invitations: structuredClone(invitations), managerLimit: 3, managerSlotsUsed: invitations.length };
}

export async function mockInviteManager(input: ManagerInvitationCreate): Promise<ManagerInvitationCreated> {
  await wait();
  const now = new Date();
  const invitation = {
    id: crypto.randomUUID(), email: input.email.toLowerCase(), role: 'manager' as const, teamMemberId: input.teamMemberId ?? null,
    createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
  };
  invitations = [invitation, ...invitations];
  return { invitation, invitationToken: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '') };
}

export async function mockRevokeInvitation(id: string) { await wait(); invitations = invitations.filter((item) => item.id !== id); }
export async function mockRevokeAccess(id: string) { void id; await wait(); }
